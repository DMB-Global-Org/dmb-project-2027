import { ConfigService } from '@nestjs/config';
import { eq, inArray } from 'drizzle-orm';
import { createTestDb, type TestDb } from '../../test/support/test-db.js';
import { notifications } from '../db/schema/index.js';
import { TxRunner } from '../db/tx-runner.js';
import {
  MailError,
  type MailMessage,
  type MailTransport,
} from './mail.types.js';
import {
  LEASE_MS,
  MAX_ATTEMPTS,
  OutboxDispatcher,
  retryDelayMs,
} from './outbox-dispatcher.js';
import { OutboxService } from './outbox.service.js';

class FakeTransport implements MailTransport {
  sent: MailMessage[] = [];
  /** What to do for the next sends; empty = succeed. */
  failures: (MailError | Error)[] = [];
  delayMs = 0;

  async send(message: MailMessage): Promise<void> {
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    const failure = this.failures.shift();
    if (failure) throw failure;
    this.sent.push(message);
  }
}

const PAYLOAD = {
  url: 'https://app.example.com/register/secret-token',
  kind: 'PARTNER' as const,
  expiresAt: '2026-12-01T10:30:00.000Z',
};

describe('outbox (integration)', () => {
  let testDb: TestDb;
  let outbox: OutboxService;
  let transport: FakeTransport;
  let dispatcher: OutboxDispatcher;
  const tx = () => new TxRunner(testDb.db);
  const ids: string[] = [];

  const config = new ConfigService({
    NODE_ENV: 'test',
    MAIL_DISPATCH_INTERVAL_MS: 0,
  }) as never;

  const queue = async (email = `${crypto.randomUUID()}@example.com`) => {
    const id = await outbox.enqueue(testDb.db, {
      type: 'invitation',
      recipientEmail: email,
      locale: 'en',
      payload: PAYLOAD,
    });
    ids.push(id);
    return id;
  };
  const row = async (id: string) => {
    const [found] = await testDb.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id));
    return found!;
  };
  // The database stamps rows with microsecond precision, JavaScript clocks
  // have milliseconds: a run in the same millisecond as the insert would not
  // see the row yet. A second of slack makes the tests deterministic.
  const SLACK_MS = 1_000;
  /** Runs the dispatcher `offsetMs` (plus the slack) from now. */
  const run = (offsetMs = 0) =>
    dispatcher.runOnce(new Date(Date.now() + SLACK_MS + offsetMs));

  beforeAll(() => {
    testDb = createTestDb();
    outbox = new OutboxService(testDb.db);
  });

  beforeEach(async () => {
    // Other tests' leftovers must not be picked up by this one.
    await testDb.db
      .update(notifications)
      .set({ status: 'FAILED', payload: null })
      .where(eq(notifications.status, 'PENDING'));
    transport = new FakeTransport();
    dispatcher = new OutboxDispatcher(testDb.db, tx(), transport, config);
  });

  afterAll(async () => {
    await testDb.close();
  });

  it('sends a queued message and forgets its secret payload', async () => {
    const id = await queue('jan@example.com');

    expect(await run()).toEqual({ sent: 1, retrying: 0, failed: 0 });

    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]).toMatchObject({
      to: 'jan@example.com',
      subject: 'Invitation to dMb Projekt 2027',
    });
    expect(transport.sent[0]!.text).toContain(PAYLOAD.url);
    const after = await row(id);
    expect(after).toMatchObject({ status: 'SENT', attempts: 1, payload: null });
    expect(after.sentAt).not.toBeNull();
  });

  it('does not send a message twice', async () => {
    await queue();

    await run();
    const second = await run();

    expect(second.sent).toBe(0);
    expect(transport.sent).toHaveLength(1);
  });

  it('leaves nothing queued when the surrounding operation rolls back', async () => {
    const email = `${crypto.randomUUID()}@example.com`;

    await expect(
      tx().run(async (t) => {
        await outbox.enqueue(t, {
          type: 'invitation',
          recipientEmail: email,
          locale: 'pl',
          payload: PAYLOAD,
        });
        throw new Error('the business operation failed');
      }),
    ).rejects.toThrow('the business operation failed');

    expect(await run()).toEqual({ sent: 0, retrying: 0, failed: 0 });
    expect(transport.sent).toHaveLength(0);
  });

  it('tries again later after a temporary failure, not before', async () => {
    const id = await queue();
    transport.failures.push(new MailError('MailerSend 503', false));

    expect(await run()).toEqual({ sent: 0, retrying: 1, failed: 0 });

    const waiting = await row(id);
    expect(waiting.status).toBe('PENDING');
    expect(waiting.attempts).toBe(1);
    expect(waiting.lastError).toContain('503');
    expect(waiting.payload).not.toBeNull(); // still needed for the retry

    // Too early: nothing happens.
    expect((await run(retryDelayMs(1) - 5_000)).sent).toBe(0);
    // Due: it goes out.
    expect(await run(retryDelayMs(1) + 5_000)).toEqual({
      sent: 1,
      retrying: 0,
      failed: 0,
    });
    expect((await row(id)).status).toBe('SENT');
  });

  it('gives up at once on a permanent failure and clears the payload', async () => {
    const id = await queue();
    transport.failures.push(new MailError('MailerSend 422', true));

    expect(await run()).toEqual({ sent: 0, retrying: 0, failed: 1 });

    expect(await row(id)).toMatchObject({
      status: 'FAILED',
      attempts: 1,
      payload: null,
    });
    expect((await run(24 * 3600_000)).sent).toBe(0);
  });

  it('gives up after the last allowed attempt', async () => {
    const id = await queue();
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      transport.failures.push(new Error('network down'));
    }

    let offset = 0;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const result = await run(offset);
      expect(result.sent).toBe(0);
      offset += 3 * 3600_000; // beyond any delay
    }

    expect(await row(id)).toMatchObject({
      status: 'FAILED',
      attempts: MAX_ATTEMPTS,
      payload: null,
    });
    expect(transport.sent).toHaveLength(0);
  });

  it('treats an unknown template as a permanent failure', async () => {
    const [{ id }] = await testDb.db
      .insert(notifications)
      .values({
        type: 'no-such-template',
        recipientEmail: 'a@b.pl',
        payload: {},
      })
      .returning({ id: notifications.id });
    ids.push(id);

    expect(await run()).toMatchObject({ failed: 1 });
    expect((await row(id)).status).toBe('FAILED');
  });

  it('sends each message once when two dispatchers run at the same time', async () => {
    transport.delayMs = 20;
    const queued = await Promise.all(Array.from({ length: 8 }, () => queue()));
    const other = new OutboxDispatcher(testDb.db, tx(), transport, config);

    const later = new Date(Date.now() + SLACK_MS);
    const [a, b] = await Promise.all([
      dispatcher.runOnce(later),
      other.runOnce(later),
    ]);

    expect(a.sent + b.sent).toBe(8);
    expect(transport.sent).toHaveLength(8);
    expect(new Set(transport.sent.map((m) => m.to)).size).toBe(8);
    const rows = await testDb.db
      .select()
      .from(notifications)
      .where(inArray(notifications.id, queued));
    expect(rows.every((r) => r.status === 'SENT' && r.attempts === 1)).toBe(
      true,
    );
  });

  it('frees a message whose sender crashed once the lease is over', async () => {
    const id = await queue();
    // Simulate a crash: claimed (leased, attempt counted) but never finished.
    await testDb.db
      .update(notifications)
      .set({ attempts: 1, nextAttemptAt: new Date(Date.now() + LEASE_MS) })
      .where(eq(notifications.id, id));

    expect((await run(60_000)).sent).toBe(0); // still leased
    expect((await run(LEASE_MS + 60_000)).sent).toBe(1);
    expect(await row(id)).toMatchObject({ status: 'SENT', attempts: 2 });
  });
});
