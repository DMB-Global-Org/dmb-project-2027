import type { INestApplication } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import request from 'supertest';
import {
  type Agent,
  createTestApp,
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
import { AuditService } from '../audit/audit.service.js';
import { orgTables } from '../db/org/org-tables.js';
import {
  accounts,
  auditLog,
  invitations,
  notifications,
  orgSchemas,
} from '../db/schema/index.js';

const LOGIN = `mutation ($email: String!, $password: String!) {
  login(email: $email, password: $password) { id }
}`;
const NODE =
  'id role state status recommenderId isOrgRoot detachedOrg promotedAt promotedBy allowedActions';
const PROMOTE = `mutation ($id: ID!) { promoteAccount(id: $id) { ${NODE} } }`;
const STRUCTURE = `{ structure { depth account { ${NODE} } } }`;
const ACCOUNT = `query ($id: ID!) { account(id: $id) { ${NODE} } }`;
const STATUS = `mutation ($id: ID!, $status: PartnerStatus!) {
  changeAccountStatus(id: $id, status: $status) { id status } }`;
const ROLE = `mutation ($id: ID!, $role: Role!) {
  changeAccountRole(id: $id, role: $role) { id role } }`;
const DEACTIVATE = 'mutation ($id: ID!) { deactivateAccount(id: $id) { id } }';
const REMOVE = 'mutation ($id: ID!) { removeAccountFromStructure(id: $id) }';
const MOVE = `mutation ($id: ID!, $recommenderId: ID!) {
  changeAccountRecommender(id: $id, recommenderId: $recommenderId) { id } }`;
const CREATE_INVITATION = `mutation ($input: CreateInvitationInput!) {
  createInvitation(input: $input) { url invitation { id } } }`;
const PREVIEW =
  'query ($token: String!) { invitation(token: $token) { kind } }';
const REGISTER = `mutation ($input: RegisterInput!) {
  register(input: $input) { id } }`;

describe('promotion to Platinum (integration)', () => {
  let app: INestApplication;
  let testDb: TestDb;

  const anonymous = () => request(app.getHttpServer());
  const agentFor = async (email: string): Promise<Agent> => {
    const agent = request.agent(app.getHttpServer());
    const body = await gql(agent, LOGIN, { email, password: TEST_PASSWORD });
    expect(body.errors).toBeUndefined();
    return agent;
  };

  /**
   * root (Platinum) -> a (Anna) -> a1 -> a2
   *                 -> b
   * `a` is the one to promote; all of them active.
   */
  async function newOrg() {
    const { org, root } = await createOrgWithRoot(testDb);
    const under = (recommenderId: string, extra = {}) =>
      createPartner(testDb, org, { recommenderId, ...extra });
    const a = await under(root.accountId, {
      firstName: 'Anna',
      lastName: 'Adamska',
    });
    const a1 = await under(a.accountId);
    const a2 = await under(a1.accountId);
    const b = await under(root.accountId);
    return { org, root, a, a1, a2, b };
  }

  const orgOf = async (accountId: string) => {
    const [row] = await testDb.db
      .select({ orgSchema: accounts.orgSchema })
      .from(accounts)
      .where(eq(accounts.id, accountId));
    return row!.orgSchema!;
  };

  const partnerIn = async (schema: string, id: string) => {
    const { partners } = orgTables(schema);
    const [row] = await testDb.db
      .select()
      .from(partners)
      .where(eq(partners.accountId, id));
    return row;
  };

  const registryOf = async (name: string) => {
    const [row] = await testDb.db
      .select()
      .from(orgSchemas)
      .where(eq(orgSchemas.name, name));
    return row!;
  };

  const orgSchemaCount = async () => {
    const rows = await testDb.db.execute<{ n: string }>(
      sql`select count(*)::text as n from information_schema.schemata where schema_name like 'org\\_%'`,
    );
    return Number(rows[0]!.n);
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

  const idsOf = (body: { data?: Record<string, any> | null }) =>
    body.data!.structure.map(
      (r: { account: { id: string } }) => r.account.id,
    ) as string[];

  const makeAdmin = async (email: string, id: string) => {
    const superAdmin = await createSuperAdmin(testDb);
    const body = await gql(await agentFor(superAdmin.email), ROLE, {
      id,
      role: 'ADMINISTRATOR',
    });
    expect(body.errors).toBeUndefined();
    return agentFor(email);
  };

  beforeAll(async () => {
    testDb = createTestDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await testDb.close();
  });

  describe('what moves', () => {
    it('moves the person and their downline into a new schema and registers it', async () => {
      const { org, root, a, a1, a2, b } = await newOrg();

      const body = await gql(await agentFor(root.email), PROMOTE, {
        id: a.accountId,
      });

      expect(body.errors).toBeUndefined();
      const next = await orgOf(a.accountId);
      expect(next).not.toBe(org);
      // The branch follows the person; everybody else stays.
      expect(await orgOf(a1.accountId)).toBe(next);
      expect(await orgOf(a2.accountId)).toBe(next);
      expect(await orgOf(b.accountId)).toBe(org);
      expect(await orgOf(root.accountId)).toBe(org);

      // New schema: same identifiers, the person at the head as a Platinum.
      const head = await partnerIn(next, a.accountId);
      expect(head).toMatchObject({
        role: 'PLATINUM',
        recommenderId: null,
        state: 'ACTIVE',
        firstName: 'Anna',
      });
      expect(await partnerIn(next, a1.accountId)).toMatchObject({
        recommenderId: a.accountId,
        role: 'GENERAL',
        state: 'ACTIVE',
      });
      expect(await partnerIn(next, a2.accountId)).toMatchObject({
        recommenderId: a1.accountId,
      });

      // Old schema: only the marker of the person is left, without a downline.
      expect(await partnerIn(org, a1.accountId)).toBeUndefined();
      expect(await partnerIn(org, a2.accountId)).toBeUndefined();
      expect(await partnerIn(org, a.accountId)).toMatchObject({
        role: 'PLATINUM',
        recommenderId: root.accountId,
      });
      expect(await partnerIn(org, b.accountId)).toBeDefined();

      const registry = await registryOf(next);
      expect(registry).toMatchObject({
        rootAccountId: a.accountId,
        sourceSchema: org,
        promotedBy: root.accountId,
        previousRecommenderId: root.accountId,
      });
      expect(registry.promotedAt).not.toBeNull();

      // The history of the branch moved too, with the promotion on top.
      const { roleHistory } = orgTables(next);
      const history = await testDb.db
        .select()
        .from(roleHistory)
        .where(eq(roleHistory.accountId, a.accountId));
      expect(history.map((h) => h.role)).toContain('PLATINUM');
    });

    it('logs the promotion and the new organization, and tells only the promoted person', async () => {
      const { root, a, a1 } = await newOrg();

      await gql(await agentFor(root.email), PROMOTE, { id: a.accountId });

      const [promotion] = await auditFor(a.accountId, 'account.promote');
      expect(promotion).toMatchObject({
        actorAccountId: root.accountId,
        before: { role: 'GENERAL' },
        after: {
          role: 'PLATINUM',
          movedAccountIds: expect.arrayContaining([a1.accountId]),
        },
      });
      expect(await auditFor(a.accountId, 'organization.create')).toHaveLength(
        1,
      );
      const toPromoted = (await queuedFor(a.email)).filter(
        (n) => n.type === 'promoted',
      );
      expect(toPromoted).toHaveLength(1);
      for (const other of [root, a1]) {
        expect(
          (await queuedFor(other.email)).filter((n) => n.type === 'promoted'),
        ).toHaveLength(0);
      }
    });

    it('lets the promoted Platinum work in their own organization', async () => {
      const { root, a, a1, a2 } = await newOrg();
      await gql(await agentFor(root.email), PROMOTE, { id: a.accountId });
      const platinum = await agentFor(a.email);

      const structure = await gql(platinum, STRUCTURE);
      const role = await gql(platinum, ROLE, {
        id: a1.accountId,
        role: 'SILVER',
      });
      const invite = await gql(platinum, CREATE_INVITATION, {
        input: {
          kind: 'PARTNER',
          recommenderId: a2.accountId,
          recipientEmail: uniqueEmail(),
        },
      });

      expect(idsOf(structure)).toEqual([
        a.accountId,
        a1.accountId,
        a2.accountId,
      ]);
      expect(structure.data!.structure[0].account).toMatchObject({
        role: 'PLATINUM',
        isOrgRoot: true,
        detachedOrg: false,
      });
      expect(role.errors).toBeUndefined();
      expect(invite.errors).toBeUndefined();
    });
  });

  describe('the line above', () => {
    it('sees the Platinum as a marker, not the organization below', async () => {
      const { root, a, a1, b } = await newOrg();
      await gql(await agentFor(root.email), PROMOTE, { id: a.accountId });
      const above = await agentFor(root.email);

      const structure = await gql(above, STRUCTURE);
      const below = await gql(above, ACCOUNT, { id: a1.accountId });
      const marker = await gql(above, ACCOUNT, { id: a.accountId });

      expect(idsOf(structure)).toEqual([
        root.accountId,
        a.accountId,
        b.accountId,
      ]);
      const entry = structure.data!.structure[1];
      expect(entry.depth).toBe(1);
      expect(entry.account).toMatchObject({
        role: 'PLATINUM',
        isOrgRoot: true,
        detachedOrg: true,
        promotedBy: root.accountId,
      });
      expect(entry.account.promotedAt).not.toBeNull();
      expect(below.data!.account).toBeNull();
      expect(marker.data!.account).toMatchObject({ detachedOrg: true });
    });

    it('lets the Platinum, an Administrator and a SuperAdministrator above change the status, not an ordinary partner', async () => {
      const { org, root } = await newOrg();
      const m = await createPartner(testDb, org, {
        recommenderId: root.accountId,
      });
      // `x` is promoted under m; m is an ordinary partner above x, root a Platinum.
      const x = await createPartner(testDb, org, {
        recommenderId: m.accountId,
      });
      await gql(await agentFor(root.email), PROMOTE, { id: x.accountId });
      const admin = await createPartner(testDb, org, {
        recommenderId: root.accountId,
      });
      const adminAgent = await makeAdmin(admin.email, admin.accountId);
      const superAdmin = await createSuperAdmin(testDb);

      const ordinary = await gql(await agentFor(m.email), STATUS, {
        id: x.accountId,
        status: 'GO_MAGIC',
      });
      const platinum = await gql(await agentFor(root.email), STATUS, {
        id: x.accountId,
        status: 'GO_MAGIC',
      });
      const bySuper = await gql(await agentFor(superAdmin.email), STATUS, {
        id: x.accountId,
        status: 'ACTIVE',
      });
      // The Administrator stands beside, not above x: out of reach.
      const beside = await gql(adminAgent, STATUS, {
        id: x.accountId,
        status: 'ACTIVE',
      });

      expect(errorOf(ordinary)?.reason).toBe('insufficient_role');
      expect(platinum.errors).toBeUndefined();
      expect(bySuper.errors).toBeUndefined();
      expect(errorOf(beside)?.code).toBe('NOT_FOUND');
    });

    it('lets an Administrator above deactivate the Platinum, but not a Platinum above', async () => {
      const { org, root } = await newOrg();
      const boss = await createPartner(testDb, org, {
        recommenderId: root.accountId,
      });
      const bossAgent = await makeAdmin(boss.email, boss.accountId);
      // boss is an Administrator above `a1b`, who is promoted.
      const a1b = await createPartner(testDb, org, {
        recommenderId: boss.accountId,
      });
      await gql(bossAgent, PROMOTE, { id: a1b.accountId });

      const byPlatinum = await gql(await agentFor(root.email), DEACTIVATE, {
        id: a1b.accountId,
      });
      const byAdmin = await gql(bossAgent, DEACTIVATE, { id: a1b.accountId });

      // The Platinum is above the organization too, yet may not deactivate it.
      expect(errorOf(byPlatinum)).toMatchObject({
        code: 'FORBIDDEN',
        reason: 'not_in_scope',
      });
      expect(byAdmin.errors).toBeUndefined();
    });

    it('reaches a Platinum of a Platinum, two levels up', async () => {
      const { root, a, a1, a2 } = await newOrg();
      // a becomes a Platinum, then promotes a1 inside the new organization.
      await gql(await agentFor(root.email), PROMOTE, { id: a.accountId });
      await gql(await agentFor(a.email), PROMOTE, { id: a1.accountId });

      const byTop = await gql(await agentFor(root.email), STATUS, {
        id: a1.accountId,
        status: 'DIAMOND_SCHOOL',
      });
      const byDirect = await gql(await agentFor(a.email), STATUS, {
        id: a1.accountId,
        status: 'GO_MAGIC',
      });
      const stranger = await newOrg();
      const byStranger = await gql(
        await agentFor(stranger.root.email),
        STATUS,
        {
          id: a1.accountId,
          status: 'ACTIVE',
        },
      );

      expect(byTop.errors).toBeUndefined();
      expect(byDirect.errors).toBeUndefined();
      expect(errorOf(byStranger)?.code).toBe('NOT_FOUND');
      // Each Platinum sees only the marker one level below, never further down.
      const top = await gql(await agentFor(root.email), ACCOUNT, {
        id: a2.accountId,
      });
      expect(top.data!.account).toBeNull();
    });

    it('cannot move or remove the marker of a detached Platinum', async () => {
      const { root, a, b } = await newOrg();
      await gql(await agentFor(root.email), PROMOTE, { id: a.accountId });
      const above = await agentFor(root.email);

      const remove = await gql(above, REMOVE, { id: a.accountId });
      const move = await gql(above, MOVE, {
        id: a.accountId,
        recommenderId: b.accountId,
      });

      expect(errorOf(remove)?.reason).toBe('root_locked');
      expect(errorOf(move)?.reason).toBe('root_locked');
    });
  });

  describe('who may promote', () => {
    it('lets a Platinum, an Administrator in the downline and a SuperAdministrator promote', async () => {
      const first = await newOrg();
      const second = await newOrg();
      const third = await newOrg();
      const admin = await makeAdmin(third.a.email, third.a.accountId);
      const superAdmin = await createSuperAdmin(testDb);

      const byPlatinum = await gql(await agentFor(first.root.email), PROMOTE, {
        id: first.a.accountId,
      });
      const bySuper = await gql(await agentFor(superAdmin.email), PROMOTE, {
        id: second.a.accountId,
      });
      const byAdmin = await gql(admin, PROMOTE, { id: third.a1.accountId });

      for (const body of [byPlatinum, bySuper, byAdmin]) {
        expect(body.errors).toBeUndefined();
      }
    });

    it('refuses an ordinary partner, an outsider, a pending account, a Platinum and oneself', async () => {
      const { org, root, a, a1, b } = await newOrg();
      const other = await newOrg();
      const pending = await createPartner(testDb, org, {
        recommenderId: root.accountId,
        state: 'PENDING_ACTIVATION',
      });

      const ordinary = await gql(await agentFor(a.email), PROMOTE, {
        id: a1.accountId,
      });
      const outsider = await gql(await agentFor(other.root.email), PROMOTE, {
        id: b.accountId,
      });
      const awaiting = await gql(await agentFor(root.email), PROMOTE, {
        id: pending.accountId,
      });
      const self = await gql(await agentFor(root.email), PROMOTE, {
        id: root.accountId,
      });
      await gql(await agentFor(root.email), PROMOTE, { id: a.accountId });
      const again = await gql(await agentFor(root.email), PROMOTE, {
        id: a.accountId,
      });

      expect(errorOf(ordinary)?.reason).toBe('insufficient_role');
      expect(errorOf(outsider)?.code).toBe('NOT_FOUND');
      expect(errorOf(awaiting)?.reason).toBe('invalid_state');
      expect(errorOf(self)?.reason).toBe('self');
      expect(errorOf(again)?.reason).toBe('already_platinum');
    });
  });

  describe('all or nothing', () => {
    it('leaves no trace when the operation fails at the very end', async () => {
      const { org, root, a, a1 } = await newOrg();
      const schemasBefore = await orgSchemaCount();
      const registryBefore = (await testDb.db.select().from(orgSchemas)).length;
      const audit = app.get(AuditService);
      const original = audit.record.bind(audit);
      const spy = vi
        .spyOn(audit, 'record')
        .mockImplementation((executor, entry) => {
          // The last thing the operation writes.
          if (entry.action === 'organization.create') {
            return Promise.reject(new Error('injected failure'));
          }
          return original(executor, entry);
        });

      const body = await gql(await agentFor(root.email), PROMOTE, {
        id: a.accountId,
      });
      spy.mockRestore();

      expect(body.errors).toBeDefined();
      // No new schema, no registry row, rows and catalog exactly as before.
      expect(await orgSchemaCount()).toBe(schemasBefore);
      expect((await testDb.db.select().from(orgSchemas)).length).toBe(
        registryBefore,
      );
      expect(await orgOf(a.accountId)).toBe(org);
      expect(await orgOf(a1.accountId)).toBe(org);
      expect(await partnerIn(org, a1.accountId)).toBeDefined();
      expect(await partnerIn(org, a.accountId)).toMatchObject({
        role: 'GENERAL',
      });
      expect(await auditFor(a.accountId, 'account.promote')).toHaveLength(0);
      expect(
        (await queuedFor(a.email)).filter((n) => n.type === 'promoted'),
      ).toHaveLength(0);
    });

    it('lets only one of two simultaneous promotions of the same person win', async () => {
      const { org, root, a } = await newOrg();
      const first = await agentFor(root.email);
      const second = await agentFor(root.email);

      const [x, y] = await Promise.all([
        gql(first, PROMOTE, { id: a.accountId }),
        gql(second, PROMOTE, { id: a.accountId }),
      ]);

      expect([x, y].filter((body) => body.errors)).toHaveLength(1);
      const roots = await testDb.db
        .select()
        .from(orgSchemas)
        .where(eq(orgSchemas.rootAccountId, a.accountId));
      expect(roots).toHaveLength(1);
      expect(roots[0]!.sourceSchema).toBe(org);
    });

    it('keeps everybody in exactly one place when a person and their descendant are promoted together', async () => {
      const { org, root, a, a1, a2 } = await newOrg();
      const first = await agentFor(root.email);
      const second = await agentFor(root.email);

      await Promise.all([
        gql(first, PROMOTE, { id: a.accountId }),
        gql(second, PROMOTE, { id: a1.accountId }),
      ]);

      // Whatever the order, each account has one real row, in its catalog schema.
      for (const person of [a, a1, a2]) {
        const home = await orgOf(person.accountId);
        expect(await partnerIn(home, person.accountId)).toBeDefined();
      }
      // The head of every organization points to the right place in the registry.
      const heads = await testDb.db
        .select()
        .from(orgSchemas)
        .where(eq(orgSchemas.sourceSchema, org));
      expect(heads.length).toBeGreaterThanOrEqual(1);
      const registryHeads = await testDb.db
        .select()
        .from(orgSchemas)
        .where(eq(orgSchemas.rootAccountId, a.accountId));
      expect(registryHeads).toHaveLength(1);
    });

    it('carries an earlier detached organization along when its ancestor is promoted', async () => {
      const { org, root, a, a1, a2 } = await newOrg();
      // a1 is promoted first; then a, who stands above a1's marker.
      await gql(await agentFor(root.email), PROMOTE, { id: a1.accountId });
      const a1Org = await orgOf(a1.accountId);

      await gql(await agentFor(root.email), PROMOTE, { id: a.accountId });

      const aOrg = await orgOf(a.accountId);
      // a1 keeps its own organization (with a2); only the registry link moved.
      expect(await orgOf(a1.accountId)).toBe(a1Org);
      expect(await orgOf(a2.accountId)).toBe(a1Org);
      expect(await partnerIn(aOrg, a1.accountId)).toBeDefined();
      expect(await partnerIn(org, a1.accountId)).toBeUndefined();
      expect((await registryOf(a1Org)).sourceSchema).toBe(aOrg);
      // a now sees a1 as a marker below them; the root reaches both.
      const structure = await gql(await agentFor(a.email), STRUCTURE);
      expect(idsOf(structure)).toEqual([a.accountId, a1.accountId]);
      const byTop = await gql(await agentFor(root.email), STATUS, {
        id: a1.accountId,
        status: 'GO_MAGIC',
      });
      expect(byTop.errors).toBeUndefined();
    });

    it('does not leave a person who registers meanwhile in the wrong organization', async () => {
      const { root, a, a1, a2 } = await newOrg();
      const created = await gql(await agentFor(a1.email), CREATE_INVITATION, {
        input: {
          kind: 'PARTNER',
          recommenderId: a2.accountId,
          recipientEmail: uniqueEmail(),
        },
      });
      const token = created.data!.createInvitation.url.split('/register/')[1];
      const email = uniqueEmail();
      const form = {
        token,
        email,
        password: 'a long enough password',
        passwordConfirmation: 'a long enough password',
        partnerNumber: String(Math.floor(Math.random() * 9e8) + 1e8),
      };

      const [, first] = await Promise.all([
        gql(await agentFor(root.email), PROMOTE, { id: a.accountId }),
        gql(anonymous(), REGISTER, { input: form }),
      ]);
      // The link may have moved under the registration's feet: try again.
      if (first.errors) {
        expect(errorOf(first)?.code).toBe('INVITATION_INVALID');
        const retry = await gql(anonymous(), REGISTER, { input: form });
        expect(retry.errors).toBeUndefined();
      }

      const [account] = await testDb.db
        .select()
        .from(accounts)
        .where(eq(accounts.email, email));
      const home = account!.orgSchema!;
      expect(await partnerIn(home, account!.id)).toMatchObject({
        recommenderId: a2.accountId,
      });
      // The sponsor lives in the same organization as the new person.
      expect(await orgOf(a2.accountId)).toBe(home);
    });
  });

  describe('registration links', () => {
    it('keeps links of the branch working in the new organization and expires those from outside', async () => {
      const { root, a, a1, a2, b } = await newOrg();
      const superAdmin = await createSuperAdmin(testDb);
      const link = async (agent: Agent, recommenderId: string) => {
        const body = await gql(agent, CREATE_INVITATION, {
          input: {
            kind: 'PARTNER',
            recommenderId,
            recipientEmail: uniqueEmail(),
          },
        });
        expect(body.errors).toBeUndefined();
        const { url, invitation } = body.data!.createInvitation;
        return {
          id: invitation.id as string,
          token: url.split('/register/')[1],
        };
      };
      const inside = await link(await agentFor(a1.email), a2.accountId);
      const bySuper = await link(
        await agentFor(superAdmin.email),
        a2.accountId,
      );
      const fromAbove = await link(await agentFor(root.email), a1.accountId);
      const elsewhere = await link(await agentFor(root.email), b.accountId);

      await gql(await agentFor(root.email), PROMOTE, { id: a.accountId });

      const usable = async (token: string) =>
        (await gql(anonymous(), PREVIEW, { token })).data!.invitation !== null;
      expect(await usable(inside.token)).toBe(true);
      expect(await usable(bySuper.token)).toBe(true);
      expect(await usable(elsewhere.token)).toBe(true);
      expect(await usable(fromAbove.token)).toBe(false);
      const next = await orgOf(a.accountId);
      const rows = await testDb.db.select().from(invitations);
      const orgOfLink = (id: string) =>
        rows.find((r) => r.id === id)!.orgSchema;
      expect(orgOfLink(inside.id)).toBe(next);
      expect(orgOfLink(bySuper.id)).toBe(next);
      expect(orgOfLink(elsewhere.id)).not.toBe(next);
      const [revoked] = await auditFor(a1.accountId, 'invitation.revoke');
      expect(revoked).toMatchObject({ after: { reason: 'promotion' } });
    });

    it('registers a person from a moved link into the new schema', async () => {
      const { root, a, a1, a2 } = await newOrg();
      const created = await gql(await agentFor(a1.email), CREATE_INVITATION, {
        input: {
          kind: 'PARTNER',
          recommenderId: a2.accountId,
          recipientEmail: uniqueEmail(),
        },
      });
      const token = created.data!.createInvitation.url.split('/register/')[1];
      await gql(await agentFor(root.email), PROMOTE, { id: a.accountId });
      const email = uniqueEmail();

      const body = await gql(anonymous(), REGISTER, {
        input: {
          token,
          email,
          password: 'a long enough password',
          passwordConfirmation: 'a long enough password',
          partnerNumber: String(Math.floor(Math.random() * 9e8) + 1e8),
        },
      });

      expect(body.errors).toBeUndefined();
      const [account] = await testDb.db
        .select()
        .from(accounts)
        .where(eq(accounts.email, email));
      expect(account!.orgSchema).toBe(await orgOf(a.accountId));
    });
  });
});
