import type { INestApplication } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import request from 'supertest';
import {
  type Agent,
  createTestApp,
  dispatchUntil,
  errorOf,
  gql,
} from '../../test/support/app.js';
import {
  createOrgWithRoot,
  createPartner,
  createSuperAdmin,
  TEST_PASSWORD,
} from '../../test/support/fixtures.js';
import { createTestDb, type TestDb } from '../../test/support/test-db.js';
import { AuditService } from '../audit/audit.service.js';
import { orgTables } from '../db/org/org-tables.js';
import { auditLog, mailings, notifications } from '../db/schema/index.js';
import type { MailMessage } from '../mail/mail.types.js';

const LOGIN = `mutation ($email: String!, $password: String!) {
  login(email: $email, password: $password) { id }
}`;
const SEND = `mutation ($input: SendOrgMailingInput!) {
  sendOrgMailing(input: $input) { id subject minRole recipientCount pending sent failed } }`;
const AUDIENCE =
  'query ($minRole: Role) { mailingAudience(minRole: $minRole) }';
const HISTORY =
  '{ myMailings { id subject minRole recipientCount pending sent failed } }';
const ROLE = `mutation ($id: ID!, $role: Role!) {
  changeAccountRole(id: $id, role: $role) { id } }`;
const PROMOTE = 'mutation ($id: ID!) { promoteAccount(id: $id) { id } }';

const MAIL = {
  subject: 'Spotkanie',
  body: 'Zapraszamy w sobotę.\n\nDo zobaczenia.',
};

describe('organizational mailing (integration)', () => {
  let app: INestApplication;
  let testDb: TestDb;
  const mailbox: MailMessage[] = [];

  const agentFor = async (email: string): Promise<Agent> => {
    const agent = request.agent(app.getHttpServer());
    const body = await gql(agent, LOGIN, { email, password: TEST_PASSWORD });
    expect(body.errors).toBeUndefined();
    return agent;
  };

  /**
   * root (Platinum) -> a (General) -> b (Builder)
   *                 -> s (Silver)
   *                 -> pending, deactivated, removed
   * and another organization whose members must never receive it.
   */
  async function newOrg() {
    const { org, root } = await createOrgWithRoot(testDb);
    const under = (recommenderId: string, extra = {}) =>
      createPartner(testDb, org, { recommenderId, ...extra });
    const a = await under(root.accountId, { locale: 'de' });
    const b = await under(a.accountId, { role: 'BUILDER' });
    const s = await under(root.accountId, { role: 'SILVER', locale: 'en' });
    const pending = await under(root.accountId, {
      state: 'PENDING_ACTIVATION',
    });
    const deactivated = await under(root.accountId, { state: 'DEACTIVATED' });
    const removed = await under(root.accountId);
    const { partners } = orgTables(org);
    await testDb.db
      .update(partners)
      .set({ removedAt: new Date(), recommenderId: null, state: 'DEACTIVATED' })
      .where(eq(partners.accountId, removed.accountId));
    const other = await createOrgWithRoot(testDb);
    const stranger = await createPartner(testDb, other.org, {
      recommenderId: other.root.accountId,
    });
    return {
      org,
      root,
      a,
      b,
      s,
      pending,
      deactivated,
      removed,
      other,
      stranger,
    };
  }

  const queuedTo = (email: string) =>
    testDb.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientEmail, email),
          eq(notifications.type, 'orgMailing'),
        ),
      );

  const audienceOf = async (agent: Agent, minRole?: string) =>
    (await gql(agent, AUDIENCE, { minRole })).data!.mailingAudience as number;

  const sentTo = (email: string) => mailbox.find((m) => m.to === email);

  beforeAll(async () => {
    testDb = createTestDb();
    app = await createTestApp({
      mailTransport: {
        send: (message) => {
          mailbox.push(message);
          return Promise.resolve();
        },
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await testDb.close();
  });

  describe('who receives it', () => {
    it('reaches the active members of the organization, but not the sender, the waiting, the deactivated, the removed or other organizations', async () => {
      const o = await newOrg();
      const platinum = await agentFor(o.root.email);

      const body = await gql(platinum, SEND, { input: MAIL });

      expect(body.errors).toBeUndefined();
      expect(body.data!.sendOrgMailing).toMatchObject({
        subject: 'Spotkanie',
        minRole: 'GENERAL',
        recipientCount: 3,
      });
      for (const person of [o.a, o.b, o.s]) {
        expect(await queuedTo(person.email)).toHaveLength(1);
      }
      for (const person of [
        o.root,
        o.pending,
        o.deactivated,
        o.removed,
        o.stranger,
      ]) {
        expect(await queuedTo(person.email)).toHaveLength(0);
      }
    });

    it('takes the people from the chosen role upward', async () => {
      const o = await newOrg();
      const platinum = await agentFor(o.root.email);

      expect(await audienceOf(platinum, 'GENERAL')).toBe(3);
      expect(await audienceOf(platinum)).toBe(3);
      expect(await audienceOf(platinum, 'BUILDER')).toBe(2);
      expect(await audienceOf(platinum, 'SILVER')).toBe(1);
      expect(await audienceOf(platinum, 'PLATINUM')).toBe(0);

      const body = await gql(platinum, SEND, {
        input: { ...MAIL, minRole: 'BUILDER' },
      });

      expect(body.data!.sendOrgMailing.recipientCount).toBe(2);
      expect(await queuedTo(o.b.email)).toHaveLength(1);
      expect(await queuedTo(o.s.email)).toHaveLength(1);
      expect(await queuedTo(o.a.email)).toHaveLength(0);
    });

    it('reaches only the downline of an Administrator', async () => {
      const o = await newOrg();
      const superAdmin = await createSuperAdmin(testDb);
      await gql(await agentFor(superAdmin.email), ROLE, {
        id: o.a.accountId,
        role: 'ADMINISTRATOR',
      });
      const admin = await agentFor(o.a.email);

      const body = await gql(admin, SEND, { input: MAIL });

      expect(body.data!.sendOrgMailing.recipientCount).toBe(1);
      expect(await queuedTo(o.b.email)).toHaveLength(1);
      for (const person of [o.root, o.s, o.a]) {
        expect(await queuedTo(person.email)).toHaveLength(0);
      }
    });

    it('reaches every organization when a SuperAdministrator sends', async () => {
      const o = await newOrg();
      const superAdmin = await createSuperAdmin(testDb);
      const agent = await agentFor(superAdmin.email);

      const size = await audienceOf(agent);
      const body = await gql(agent, SEND, { input: MAIL });

      expect(body.data!.sendOrgMailing.recipientCount).toBe(size);
      for (const person of [o.root, o.a, o.b, o.s, o.other.root, o.stranger]) {
        expect(await queuedTo(person.email)).toHaveLength(1);
      }
      for (const person of [o.pending, o.deactivated, o.removed]) {
        expect(await queuedTo(person.email)).toHaveLength(0);
      }
    });

    it('leaves out the head of a detached organization and everybody below', async () => {
      const o = await newOrg();
      await gql(await agentFor(o.root.email), PROMOTE, { id: o.a.accountId });

      const body = await gql(await agentFor(o.root.email), SEND, {
        input: MAIL,
      });

      // Only the Silver member is left: `a` heads another organization now,
      // and `b` went with them.
      expect(body.data!.sendOrgMailing.recipientCount).toBe(1);
      expect(await queuedTo(o.s.email)).toHaveLength(1);
      expect(await queuedTo(o.a.email)).toHaveLength(0);
      expect(await queuedTo(o.b.email)).toHaveLength(0);
    });
  });

  describe('who may send', () => {
    it('refuses an ordinary partner, for the preview too', async () => {
      const o = await newOrg();
      const partner = await agentFor(o.a.email);

      const send = await gql(partner, SEND, { input: MAIL });
      const audience = await gql(partner, AUDIENCE, {});
      const history = await gql(partner, HISTORY);

      for (const body of [send, audience, history]) {
        expect(errorOf(body)).toMatchObject({
          code: 'FORBIDDEN',
          reason: 'insufficient_role',
        });
      }
    });

    it('needs a logged-in account', async () => {
      const body = await gql(request.agent(app.getHttpServer()), SEND, {
        input: MAIL,
      });
      expect(errorOf(body)?.code).toBe('UNAUTHENTICATED');
    });

    it('says so when it would reach nobody', async () => {
      const { root } = await createOrgWithRoot(testDb);

      const body = await gql(await agentFor(root.email), SEND, { input: MAIL });

      expect(errorOf(body)?.code).toBe('NO_RECIPIENTS');
      expect(
        await testDb.db
          .select()
          .from(mailings)
          .where(eq(mailings.senderAccountId, root.accountId)),
      ).toHaveLength(0);
    });

    it('refuses more than 2000 recipients at once', async () => {
      const { org, root } = await createOrgWithRoot(testDb);
      const prefix = `bulk-${root.accountId}-`;
      await testDb.db.execute(sql`
        insert into app.accounts (email, org_schema)
        select ${prefix} || g || '@example.com', ${org} from generate_series(1, 2001) g`);
      await testDb.db.execute(sql`
        insert into ${sql.identifier(org)}.partners (account_id, role, state, recommender_id)
        select id, 'GENERAL'::"app"."role", 'ACTIVE'::"app"."account_state", ${root.accountId}::uuid
          from app.accounts where email like ${prefix + '%'}`);

      const body = await gql(await agentFor(root.email), SEND, { input: MAIL });

      expect(errorOf(body)).toMatchObject({
        code: 'VALIDATION_FAILED',
        field: 'recipients',
      });
    });
  });

  describe('the content', () => {
    it('checks the fields and names the one that is wrong', async () => {
      const o = await newOrg();
      const platinum = await agentFor(o.root.email);
      const send = (input: object) => gql(platinum, SEND, { input });

      expect(errorOf(await send({ ...MAIL, subject: '   ' }))).toMatchObject({
        code: 'VALIDATION_FAILED',
        field: 'subject',
      });
      expect(
        errorOf(await send({ ...MAIL, body: 'x'.repeat(20_001) })),
      ).toMatchObject({
        field: 'body',
      });
      expect(
        errorOf(await send({ ...MAIL, subject: 'x'.repeat(201) })),
      ).toMatchObject({ field: 'subject' });
      // A language version needs both its subject and its text.
      expect(
        errorOf(await send({ ...MAIL, subjectDe: 'Betreff' })),
      ).toMatchObject({ field: 'bodyDe' });
      expect(errorOf(await send({ ...MAIL, bodyEn: 'Text' }))).toMatchObject({
        field: 'bodyEn',
      });
      // Nobody holds the SuperAdministrator role inside an organization.
      expect(
        errorOf(await send({ ...MAIL, minRole: 'SUPER_ADMINISTRATOR' })),
      ).toMatchObject({ field: 'minRole' });
      expect(
        errorOf(
          await gql(platinum, AUDIENCE, { minRole: 'SUPER_ADMINISTRATOR' }),
        ),
      ).toMatchObject({ field: 'minRole' });
    });

    it('delivers each person the version in their language, Polish when there is none', async () => {
      const o = await newOrg();

      await gql(await agentFor(o.root.email), SEND, {
        input: { ...MAIL, subjectDe: 'Treffen', bodyDe: 'Wir laden Sie ein.' },
      });
      await dispatchUntil(app, () =>
        [o.a, o.b, o.s].every((person) => sentTo(person.email)),
      );

      // `a` writes German, `s` English (not provided), `b` Polish.
      expect(sentTo(o.a.email)?.subject).toBe('Treffen');
      expect(sentTo(o.a.email)?.text).toContain('Wir laden Sie ein.');
      expect(sentTo(o.s.email)?.subject).toBe('Spotkanie');
      expect(sentTo(o.b.email)?.subject).toBe('Spotkanie');
      expect(sentTo(o.b.email)?.html).toContain('<p>Do zobaczenia.</p>');
    });
  });

  describe('the record', () => {
    it('keeps a history with how far delivery has got', async () => {
      const o = await newOrg();
      const platinum = await agentFor(o.root.email);
      const sent = await gql(platinum, SEND, { input: MAIL });
      const id = sent.data!.sendOrgMailing.id;

      const queued = await gql(platinum, HISTORY);
      expect(queued.data!.myMailings[0]).toMatchObject({
        id,
        recipientCount: 3,
        pending: 3,
        sent: 0,
        failed: 0,
      });

      await dispatchUntil(app, () =>
        [o.a, o.b, o.s].every((person) => sentTo(person.email)),
      );
      const delivered = await gql(platinum, HISTORY);
      expect(delivered.data!.myMailings[0]).toMatchObject({
        id,
        pending: 0,
        sent: 3,
        failed: 0,
      });
      // Every queued message points back to its mailing.
      const rows = await queuedTo(o.a.email);
      expect(rows[0]!.mailingId).toBe(id);
    });

    it('shows a sender only their own mailings', async () => {
      const first = await newOrg();
      const second = await newOrg();
      await gql(await agentFor(first.root.email), SEND, { input: MAIL });

      const other = await gql(await agentFor(second.root.email), HISTORY);

      expect(other.data!.myMailings).toEqual([]);
    });

    it('logs the send without the text or the list of recipients', async () => {
      const o = await newOrg();
      const body = await gql(await agentFor(o.root.email), SEND, {
        input: { ...MAIL, subject: 'Tajny temat 12345' },
      });

      const [entry] = await testDb.db
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.action, 'mailing.send'),
            eq(auditLog.objectId, body.data!.sendOrgMailing.id),
          ),
        );
      expect(entry).toMatchObject({
        actorAccountId: o.root.accountId,
        after: { minRole: 'GENERAL', recipientCount: 3, languages: ['pl'] },
      });
      const text = JSON.stringify(entry);
      expect(text).not.toContain('Tajny temat');
      expect(text).not.toContain(o.a.email);
    });

    it('leaves nothing behind when the operation fails at the very end', async () => {
      const o = await newOrg();
      const audit = app.get(AuditService);
      const original = audit.record.bind(audit);
      const spy = vi
        .spyOn(audit, 'record')
        .mockImplementation((executor, entry) =>
          entry.action === 'mailing.send'
            ? Promise.reject(new Error('injected failure'))
            : original(executor, entry),
        );

      const body = await gql(await agentFor(o.root.email), SEND, {
        input: MAIL,
      });
      spy.mockRestore();

      expect(body.errors).toBeDefined();
      expect(
        await testDb.db
          .select()
          .from(mailings)
          .where(eq(mailings.senderAccountId, o.root.accountId)),
      ).toHaveLength(0);
      for (const person of [o.a, o.b, o.s]) {
        expect(await queuedTo(person.email)).toHaveLength(0);
      }
    });
  });
});
