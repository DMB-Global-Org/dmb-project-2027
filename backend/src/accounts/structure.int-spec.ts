import type { INestApplication } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
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
  uniqueEmail,
} from '../../test/support/fixtures.js';
import { createTestDb, type TestDb } from '../../test/support/test-db.js';
import { orgTables } from '../db/org/org-tables.js';
import { accounts, auditLog, notifications } from '../db/schema/index.js';
import type { MailMessage } from '../mail/mail.types.js';

const LOGIN = `mutation ($email: String!, $password: String!) {
  login(email: $email, password: $password) { id }
}`;
const NODE = 'id recommenderId state removed allowedActions';
const MOVE = `mutation ($id: ID!, $recommenderId: ID!) {
  changeAccountRecommender(id: $id, recommenderId: $recommenderId) { ${NODE} } }`;
const REMOVE = 'mutation ($id: ID!) { removeAccountFromStructure(id: $id) }';
const CANDIDATES = `query ($id: ID!) { recommenderCandidates(id: $id) { id depth } }`;
const STRUCTURE = '{ structure { depth account { id recommenderId } } }';
const ACCOUNT = `query ($id: ID!) { account(id: $id) { ${NODE} } }`;
const MINE = '{ myInvitations { id status } }';
const CREATE_INVITATION = `mutation ($input: CreateInvitationInput!) {
  createInvitation(input: $input) { url invitation { id } } }`;
const PREVIEW =
  'query ($token: String!) { invitation(token: $token) { kind } }';
const ROLE = `mutation ($id: ID!, $role: Role!) {
  changeAccountRole(id: $id, role: $role) { id } }`;

describe('moving and removing people in the structure (integration)', () => {
  let app: INestApplication;
  let testDb: TestDb;
  const mailbox: MailMessage[] = [];

  const anonymous = () => request(app.getHttpServer());
  const agentFor = async (email: string): Promise<Agent> => {
    const agent = request.agent(app.getHttpServer());
    const body = await gql(agent, LOGIN, { email, password: TEST_PASSWORD });
    expect(body.errors).toBeUndefined();
    return agent;
  };

  /**
   * root (Platinum) -> a (Anna Adamska) -> a1 -> a2
   *                 -> b (Bogdan Brzeski)
   *                 -> c
   */
  async function newOrg() {
    const { org, root } = await createOrgWithRoot(testDb);
    const under = (recommenderId: string, extra = {}) =>
      createPartner(testDb, org, { recommenderId, ...extra });
    const a = await under(root.accountId, {
      firstName: 'Anna',
      lastName: 'Adamska',
      partnerNumber: String(Math.floor(Math.random() * 9e8) + 1e8),
    });
    const a1 = await under(a.accountId);
    const a2 = await under(a1.accountId);
    const b = await under(root.accountId, {
      firstName: 'Bogdan',
      lastName: 'Brzeski',
    });
    const c = await under(root.accountId);
    return { org, root, a, a1, a2, b, c };
  }

  const partnerRow = async (org: string, id: string) => {
    const { partners } = orgTables(org);
    const [row] = await testDb.db
      .select()
      .from(partners)
      .where(eq(partners.accountId, id));
    return row!;
  };

  const auditFor = (subject: string, action: string) =>
    testDb.db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.subjectAccountId, subject),
          eq(auditLog.action, action),
        ),
      )
      .orderBy(desc(auditLog.at));

  const queuedFor = (email: string) =>
    testDb.db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientEmail, email));

  const structureIds = async (agent: Agent) =>
    (await gql(agent, STRUCTURE)).data!.structure.map(
      (r: { account: { id: string } }) => r.account.id,
    ) as string[];

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

  describe('changing the sponsor', () => {
    it('moves a person with their whole downline and keeps who invited them', async () => {
      const { org, root, a, a1, a2, b } = await newOrg();
      const { partners } = orgTables(org);
      await testDb.db
        .update(partners)
        .set({ invitedById: root.accountId })
        .where(eq(partners.accountId, a.accountId));

      const body = await gql(await agentFor(root.email), MOVE, {
        id: a.accountId,
        recommenderId: b.accountId,
      });

      expect(body.errors).toBeUndefined();
      expect(body.data!.changeAccountRecommender.recommenderId).toBe(
        b.accountId,
      );
      const moved = await partnerRow(org, a.accountId);
      expect(moved.recommenderId).toBe(b.accountId);
      expect(moved.invitedById).toBe(root.accountId);
      // Their own people stay under them and travel with them.
      expect((await partnerRow(org, a1.accountId)).recommenderId).toBe(
        a.accountId,
      );
      const ids = await structureIds(await agentFor(b.email));
      expect(ids).toEqual([
        b.accountId,
        a.accountId,
        a1.accountId,
        a2.accountId,
      ]);
      const [entry] = await auditFor(a.accountId, 'account.recommender.change');
      expect(entry).toMatchObject({
        actorAccountId: root.accountId,
        before: { recommenderId: root.accountId },
        after: { recommenderId: b.accountId },
      });
    });

    it('tells the moved person and the new sponsor, not the Platinum', async () => {
      const { root, a, b } = await newOrg();

      await gql(await agentFor(root.email), MOVE, {
        id: a.accountId,
        recommenderId: b.accountId,
      });
      await dispatchUntil(
        app,
        () =>
          mailbox.some((m) => m.to === a.email) &&
          mailbox.some((m) => m.to === b.email),
      );

      const toMoved = mailbox.find((m) => m.to === a.email);
      const toSponsor = mailbox.find((m) => m.to === b.email);
      expect(toMoved?.text).toContain('Bogdan Brzeski');
      expect(toSponsor?.text).toContain('Anna Adamska');
      const rootMail = (await queuedFor(root.email)).filter(
        (n) => n.type === 'recommenderChanged',
      );
      expect(rootMail).toHaveLength(0);
    });

    it('lets any partner rearrange their own downline, whatever their role', async () => {
      const { org, a, a1, a2 } = await newOrg();

      const body = await gql(await agentFor(a.email), MOVE, {
        id: a2.accountId,
        recommenderId: a.accountId,
      });

      expect(body.errors).toBeUndefined();
      expect((await partnerRow(org, a2.accountId)).recommenderId).toBe(
        a.accountId,
      );
      expect((await partnerRow(org, a1.accountId)).recommenderId).toBe(
        a.accountId,
      );
    });

    it('lets an Administrator move people in their downline', async () => {
      const { org, a, a1, a2 } = await newOrg();
      const superAdmin = await createSuperAdmin(testDb);
      await gql(await agentFor(superAdmin.email), ROLE, {
        id: a.accountId,
        role: 'ADMINISTRATOR',
      });

      const body = await gql(await agentFor(a.email), MOVE, {
        id: a2.accountId,
        recommenderId: a.accountId,
      });

      expect(body.errors).toBeUndefined();
      expect((await partnerRow(org, a2.accountId)).recommenderId).toBe(
        a.accountId,
      );
      expect((await partnerRow(org, a1.accountId)).recommenderId).toBe(
        a.accountId,
      );
    });

    it('does nothing, and writes nothing, for the sponsor they already have', async () => {
      const { root, a } = await newOrg();

      const body = await gql(await agentFor(root.email), MOVE, {
        id: a.accountId,
        recommenderId: root.accountId,
      });

      expect(body.errors).toBeUndefined();
      expect(
        await auditFor(a.accountId, 'account.recommender.change'),
      ).toHaveLength(0);
      expect(
        (await queuedFor(a.email)).filter(
          (n) => n.type === 'recommenderChanged',
        ),
      ).toHaveLength(0);
    });

    it('refuses a cycle, themselves, the root and somebody outside the caller line', async () => {
      const { root, a, a1, a2, b } = await newOrg();
      const platinum = await agentFor(root.email);

      const cycle = await gql(platinum, MOVE, {
        id: a.accountId,
        recommenderId: a2.accountId,
      });
      const self = await gql(platinum, MOVE, {
        id: a.accountId,
        recommenderId: a.accountId,
      });
      const ownRoot = await gql(platinum, MOVE, {
        id: root.accountId,
        recommenderId: b.accountId,
      });
      // `a` rules over a1 but not over `b`: they cannot hand people to b.
      const outside = await gql(await agentFor(a.email), MOVE, {
        id: a1.accountId,
        recommenderId: b.accountId,
      });

      expect(errorOf(cycle)?.reason).toBe('cycle');
      expect(errorOf(self)?.reason).toBe('cycle');
      expect(errorOf(ownRoot)?.reason).toBe('self');
      expect(errorOf(outside)?.reason).toBe('not_in_scope');
    });

    it('does not let anybody but a SuperAdministrator even touch the root', async () => {
      const { root, a } = await newOrg();
      const superAdmin = await createSuperAdmin(testDb);

      const byChild = await gql(await agentFor(a.email), MOVE, {
        id: root.accountId,
        recommenderId: a.accountId,
      });
      const bySuper = await gql(await agentFor(superAdmin.email), MOVE, {
        id: root.accountId,
        recommenderId: a.accountId,
      });

      expect(errorOf(byChild)?.code).toBe('NOT_FOUND');
      expect(errorOf(bySuper)?.reason).toBe('root_locked');
    });

    it('refuses a sponsor from another organization, one not active and an unknown one', async () => {
      const { root, a } = await newOrg();
      const other = await newOrg();
      const superAdmin = await createSuperAdmin(testDb);

      const foreign = await gql(await agentFor(root.email), MOVE, {
        id: a.accountId,
        recommenderId: other.root.accountId,
      });
      const foreignBySuper = await gql(await agentFor(superAdmin.email), MOVE, {
        id: a.accountId,
        recommenderId: other.root.accountId,
      });
      const unknown = await gql(await agentFor(root.email), MOVE, {
        id: a.accountId,
        recommenderId: '00000000-0000-4000-8000-000000000000',
      });

      expect(errorOf(foreign)?.reason).toBe('not_in_scope');
      expect(errorOf(foreignBySuper)?.reason).toBe('other_org');
      expect(errorOf(unknown)?.code).toBe('NOT_FOUND');
    });

    it('refuses a sponsor who is waiting for activation or deactivated (decision 86)', async () => {
      const { org, root, a } = await newOrg();
      const pending = await createPartner(testDb, org, {
        recommenderId: root.accountId,
        state: 'PENDING_ACTIVATION',
      });
      const idle = await createPartner(testDb, org, {
        recommenderId: root.accountId,
        state: 'DEACTIVATED',
      });
      const agent = await agentFor(root.email);

      for (const sponsor of [pending, idle]) {
        const body = await gql(agent, MOVE, {
          id: a.accountId,
          recommenderId: sponsor.accountId,
        });
        expect(errorOf(body)?.reason).toBe('recommender_not_active');
      }
    });

    it('lets only one of two simultaneous moves that would close a cycle win', async () => {
      const { org, root, a, b } = await newOrg();
      const first = await agentFor(root.email);
      const second = await agentFor(root.email);

      // a under b and b under a: each is fine alone, not both.
      const [x, y] = await Promise.all([
        gql(first, MOVE, { id: a.accountId, recommenderId: b.accountId }),
        gql(second, MOVE, { id: b.accountId, recommenderId: a.accountId }),
      ]);

      const failures = [x, y].filter((body) => body.errors);
      expect(failures).toHaveLength(1);
      expect(errorOf(failures[0]!)?.reason).toBe('cycle');
      // Everybody is still reachable from the root: no loop was created.
      const ids = await structureIds(await agentFor(root.email));
      expect(ids).toContain(a.accountId);
      expect(ids).toContain(b.accountId);
      expect((await partnerRow(org, root.accountId)).recommenderId).toBeNull();
    });

    it('lists whom a person could be moved under', async () => {
      const { org, root, a, a1, a2, b, c } = await newOrg();
      await createPartner(testDb, org, {
        recommenderId: root.accountId,
        state: 'PENDING_ACTIVATION',
      });

      const asPlatinum = await gql(await agentFor(root.email), CANDIDATES, {
        id: a1.accountId,
      });
      const asOrdinary = await gql(await agentFor(a.email), CANDIDATES, {
        id: a2.accountId,
      });
      const outsider = await gql(await agentFor(b.email), CANDIDATES, {
        id: a1.accountId,
      });

      const ids = (body: typeof asPlatinum) =>
        body.data!.recommenderCandidates.map((r: { id: string }) => r.id);
      // Not a1 itself, not their downline, not their current sponsor (a), not the pending one.
      expect(new Set(ids(asPlatinum))).toEqual(
        new Set([root.accountId, b.accountId, c.accountId]),
      );
      // An ordinary partner sees only their own branch.
      expect(ids(asOrdinary)).toEqual([a.accountId]);
      expect(errorOf(outsider)?.code).toBe('NOT_FOUND');
    });

    it('offers the actions the caller may take', async () => {
      const { root, a, a1 } = await newOrg();

      const platinum = await gql(await agentFor(root.email), ACCOUNT, {
        id: a.accountId,
      });
      const ordinary = await gql(await agentFor(a.email), ACCOUNT, {
        id: a1.accountId,
      });

      expect(platinum.data!.account.allowedActions).toEqual(
        expect.arrayContaining(['CHANGE_RECOMMENDER', 'REMOVE_FROM_STRUCTURE']),
      );
      // An ordinary partner may move their people, not remove them.
      expect(ordinary.data!.account.allowedActions).toEqual([
        'CHANGE_RECOMMENDER',
      ]);
    });
  });

  describe('removing from the structure', () => {
    it('moves the downline up, marks the account removed and cuts it off', async () => {
      const { org, root, a, a1, a2 } = await newOrg();
      const victim = await agentFor(a.email);
      expect((await gql(victim, MINE)).errors).toBeUndefined();

      const body = await gql(await agentFor(root.email), REMOVE, {
        id: a.accountId,
      });

      expect(body.data!.removeAccountFromStructure).toBe(true);
      // Those they sponsored are now the Platinum's; their own line goes along.
      expect((await partnerRow(org, a1.accountId)).recommenderId).toBe(
        root.accountId,
      );
      expect((await partnerRow(org, a2.accountId)).recommenderId).toBe(
        a1.accountId,
      );
      const row = await partnerRow(org, a.accountId);
      expect(row).toMatchObject({
        state: 'DEACTIVATED',
        removedBy: root.accountId,
        removedRecommenderId: root.accountId,
        recommenderId: null,
      });
      expect(row.removedAt).not.toBeNull();
      expect(errorOf(await gql(victim, MINE))?.code).toBe('UNAUTHENTICATED');
      // Gone from the tree for everybody who looks.
      const ids = await structureIds(await agentFor(root.email));
      expect(ids).not.toContain(a.accountId);
      expect(ids).toContain(a1.accountId);
    });

    it('logs the removal and every person who changed sponsor', async () => {
      const { root, a, a1 } = await newOrg();

      await gql(await agentFor(root.email), REMOVE, { id: a.accountId });

      const [removal] = await auditFor(a.accountId, 'account.remove');
      expect(removal).toMatchObject({
        actorAccountId: root.accountId,
        before: { recommenderId: root.accountId, state: 'ACTIVE' },
        after: { state: 'DEACTIVATED', movedDownline: [a1.accountId] },
      });
      const [moved] = await auditFor(
        a1.accountId,
        'account.recommender.change',
      );
      expect(moved).toMatchObject({
        before: { recommenderId: a.accountId },
        after: { recommenderId: root.accountId, reason: 'removal' },
      });
    });

    it('sends nobody an e-mail', async () => {
      const { root, a, a1 } = await newOrg();

      await gql(await agentFor(root.email), REMOVE, { id: a.accountId });

      for (const person of [a, a1, root]) {
        expect(
          (await queuedFor(person.email)).filter(
            (n) => n.type === 'recommenderChanged',
          ),
        ).toHaveLength(0);
      }
    });

    it('keeps the Partner number reserved', async () => {
      const { org, root, a } = await newOrg();
      await gql(await agentFor(root.email), REMOVE, { id: a.accountId });

      const [row] = await testDb.db
        .select({ number: accounts.partnerNumber })
        .from(accounts)
        .where(eq(accounts.id, a.accountId));
      await expect(
        createPartner(testDb, org, { partnerNumber: row!.number! }),
      ).rejects.toThrow();
    });

    it('refuses oneself and the root of an organization', async () => {
      const { root } = await newOrg();
      const superAdmin = await createSuperAdmin(testDb);

      const self = await gql(await agentFor(root.email), REMOVE, {
        id: root.accountId,
      });
      const rootBySuper = await gql(await agentFor(superAdmin.email), REMOVE, {
        id: root.accountId,
      });

      expect(errorOf(self)?.reason).toBe('self');
      expect(errorOf(rootBySuper)?.reason).toBe('root_locked');
    });

    it('lets an Administrator remove in their downline and a SuperAdministrator anywhere', async () => {
      const { org, a, a1, a2, b } = await newOrg();
      const superAdmin = await createSuperAdmin(testDb);
      await gql(await agentFor(superAdmin.email), ROLE, {
        id: a.accountId,
        role: 'ADMINISTRATOR',
      });

      const below = await gql(await agentFor(a.email), REMOVE, {
        id: a1.accountId,
      });
      const above = await gql(await agentFor(a.email), REMOVE, {
        id: b.accountId,
      });
      const anywhere = await gql(await agentFor(superAdmin.email), REMOVE, {
        id: b.accountId,
      });

      expect(below.errors).toBeUndefined();
      expect(errorOf(above)?.code).toBe('NOT_FOUND');
      expect(anywhere.errors).toBeUndefined();
      expect((await partnerRow(org, a2.accountId)).recommenderId).toBe(
        a.accountId,
      );
    });

    it('does not let an ordinary partner remove anybody', async () => {
      const { a, a1 } = await newOrg();

      const body = await gql(await agentFor(a.email), REMOVE, {
        id: a1.accountId,
      });

      expect(errorOf(body)?.reason).toBe('insufficient_role');
    });

    it('hides a removed account from everybody but a SuperAdministrator, who cannot act on it', async () => {
      const { root, a } = await newOrg();
      const superAdmin = await createSuperAdmin(testDb);
      await gql(await agentFor(root.email), REMOVE, { id: a.accountId });

      const byPlatinum = await gql(await agentFor(root.email), ACCOUNT, {
        id: a.accountId,
      });
      const bySuper = await gql(await agentFor(superAdmin.email), ACCOUNT, {
        id: a.accountId,
      });
      const activate = await gql(
        await agentFor(superAdmin.email),
        `mutation ($id: ID!) { activateAccount(id: $id) { id } }`,
        { id: a.accountId },
      );

      expect(byPlatinum.data!.account).toBeNull();
      expect(bySuper.data!.account).toMatchObject({
        removed: true,
        state: 'DEACTIVATED',
        allowedActions: [],
      });
      expect(errorOf(activate)?.reason).toBe('target_removed');
    });

    it('cannot be named as a sponsor any more, and links naming them stop working', async () => {
      const { root, a, a1 } = await newOrg();
      const platinum = await agentFor(root.email);
      const created = await gql(platinum, CREATE_INVITATION, {
        input: {
          kind: 'PARTNER',
          recommenderId: a.accountId,
          recipientEmail: uniqueEmail(),
        },
      });
      const token = created.data!.createInvitation.url.split('/register/')[1];
      expect(
        (await gql(anonymous(), PREVIEW, { token })).data!.invitation,
      ).not.toBeNull();

      await gql(platinum, REMOVE, { id: a.accountId });

      expect(
        (await gql(anonymous(), PREVIEW, { token })).data!.invitation,
      ).toBe(null);
      const again = await gql(platinum, CREATE_INVITATION, {
        input: {
          kind: 'PARTNER',
          recommenderId: a.accountId,
          recipientEmail: uniqueEmail(),
        },
      });
      expect(errorOf(again)?.reason).toBe('recommender_removed');
      const move = await gql(platinum, MOVE, {
        id: a1.accountId,
        recommenderId: a.accountId,
      });
      // Outside everybody's line now, so the move is refused (for a
      // SuperAdministrator the reason is `recommender_removed`).
      expect(errorOf(move)?.code).toBe('FORBIDDEN');
    });
  });
});
