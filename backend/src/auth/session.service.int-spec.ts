import { eq } from 'drizzle-orm';
import { createOrg, createPartner } from '../../test/support/fixtures.js';
import { createTestDb, type TestDb } from '../../test/support/test-db.js';
import { sessions } from '../db/schema/index.js';
import { authConfigFrom } from './auth.config.js';
import { hashSessionToken, SessionService } from './session.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const META = { ip: '203.0.113.7', userAgent: 'vitest' };

describe('SessionService (integration)', () => {
  let testDb: TestDb;
  let service: SessionService;
  let accountId: string;

  beforeAll(async () => {
    testDb = createTestDb();
    service = new SessionService(
      testDb.db,
      authConfigFrom({ NODE_ENV: 'test', SESSION_TTL_DAYS: 14 }),
    );
    accountId = (await createPartner(testDb, await createOrg(testDb)))
      .accountId;
  });

  afterAll(async () => {
    await testDb.close();
  });

  it('starts a session that resolves back to its account', async () => {
    const { token } = await service.create(accountId, META);

    expect(await service.resolve(token)).toMatchObject({ accountId });
  });

  it('stores only a hash of the token, plus where the login came from', async () => {
    const { token } = await service.create(accountId, META);

    const [row] = await testDb.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, hashSessionToken(token)));
    expect(row?.tokenHash).not.toBe(token);
    expect(row?.ip).toBe(META.ip);
    expect(row?.userAgent).toBe(META.userAgent);

    const stored = await testDb.db.select().from(sessions);
    expect(stored.some((s) => s.tokenHash === token)).toBe(false);
  });

  it('gives every session its own unguessable token', async () => {
    const a = await service.create(accountId, META);
    const b = await service.create(accountId, META);

    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(43);
  });

  it('expires after the configured time', async () => {
    const start = new Date();
    const { token, expiresAt } = await service.create(accountId, META, start);

    expect(expiresAt.getTime() - start.getTime()).toBe(14 * DAY_MS);
    expect(
      await service.resolve(
        token,
        new Date(start.getTime() + 14 * DAY_MS - 1000),
      ),
    ).not.toBeNull();
    expect(
      await service.resolve(
        token,
        new Date(start.getTime() + 14 * DAY_MS + 1000),
      ),
    ).toBeNull();
  });

  it('does not resolve unknown tokens', async () => {
    expect(await service.resolve('not-a-real-token')).toBeNull();
    expect(await service.resolve('')).toBeNull();
  });

  it('stops resolving a revoked session and leaves the others alone', async () => {
    const first = await service.create(accountId, META);
    const second = await service.create(accountId, META);

    await service.revoke(first.token);

    expect(await service.resolve(first.token)).toBeNull();
    expect(await service.resolve(second.token)).not.toBeNull();
  });

  it('revokes every session of an account at once, and only that account', async () => {
    const other = (await createPartner(testDb, await createOrg(testDb)))
      .accountId;
    const mine = [
      await service.create(accountId, META),
      await service.create(accountId, META),
    ];
    const theirs = await service.create(other, META);

    await service.revokeAllFor(accountId);

    for (const { token } of mine)
      expect(await service.resolve(token)).toBeNull();
    expect(await service.resolve(theirs.token)).not.toBeNull();
  });

  it('rolls back a revocation together with the transaction that asked for it', async () => {
    const { token } = await service.create(accountId, META);

    await expect(
      testDb.db.transaction(async (tx) => {
        await service.revokeAllFor(accountId, tx);
        throw new Error('deactivation failed');
      }),
    ).rejects.toThrow('deactivation failed');

    expect(await service.resolve(token)).not.toBeNull();
  });

  it('forgets sessions that ended more than a week ago', async () => {
    const longAgo = new Date(Date.now() - 30 * DAY_MS);
    const old = await service.create(accountId, META, longAgo);

    await service.create(accountId, META); // housekeeping runs on create

    const rows = await testDb.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, hashSessionToken(old.token)));
    expect(rows).toHaveLength(0);
  });
});
