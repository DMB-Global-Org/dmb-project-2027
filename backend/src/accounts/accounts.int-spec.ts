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
import {
  accounts,
  auditLog,
  invitations,
  notifications,
} from '../db/schema/index.js';
import type { MailMessage } from '../mail/mail.types.js';

const LOGIN = `mutation ($email: String!, $password: String!) {
  login(email: $email, password: $password) { id }
}`;
const NODE = `id email firstName lastName phone partnerNumber partnerCountry role status state
  profileCompleted recommenderId isOrgRoot allowedActions assignableRoles`;
const STRUCTURE = `{ structure { depth account { ${NODE} } } }`;
const ACCOUNT = `query ($id: ID!) { account(id: $id) { ${NODE} } }`;
const MY_PROFILE = `{ myProfile { id email firstName lastName phone partnerNumber
  partnerCountry state profileCompletedAt consentsAcceptedAt } }`;
const ACTIVATE = `mutation ($id: ID!) { activateAccount(id: $id) { ${NODE} } }`;
const DEACTIVATE = `mutation ($id: ID!) { deactivateAccount(id: $id) { ${NODE} } }`;
const ROLE = `mutation ($id: ID!, $role: Role!) {
  changeAccountRole(id: $id, role: $role) { ${NODE} } }`;
const STATUS = `mutation ($id: ID!, $status: PartnerStatus!) {
  changeAccountStatus(id: $id, status: $status) { ${NODE} } }`;
const PROFILE = `mutation ($input: UpdateProfileInput!) {
  updateMyProfile(input: $input) { firstName lastName phone state
    profileCompletedAt consentsAcceptedAt } }`;
const DATA = `mutation ($id: ID!, $input: UpdateAccountDataInput!) {
  updateAccountData(id: $id, input: $input) { ${NODE} } }`;
const PNUM = `mutation ($id: ID!, $input: PartnerNumberInput!) {
  updatePartnerNumber(id: $id, input: $input) { ${NODE} } }`;
const CREATE_INVITATION = `mutation ($input: CreateInvitationInput!) {
  createInvitation(input: $input) { url invitation { id status } } }`;
const REVOKE = `mutation ($id: ID!) { revokeInvitation(id: $id) { id status } }`;
const MINE = '{ myInvitations { id status } }';
const PREVIEW =
  'query ($token: String!) { invitation(token: $token) { kind } }';

const GOOD_PROFILE = {
  firstName: 'Anna',
  lastName: 'Nowak',
  phone: '+48 600 100 200',
  acceptConsents: true,
};

describe('account administration (integration)', () => {
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

  /** An organization: root (Platinum) -> a -> a1; root -> b. All active. */
  async function newOrg() {
    const { org, root } = await createOrgWithRoot(testDb);
    const a = await createPartner(testDb, org, {
      recommenderId: root.accountId,
    });
    const a1 = await createPartner(testDb, org, {
      recommenderId: a.accountId,
    });
    const b = await createPartner(testDb, org, {
      recommenderId: root.accountId,
    });
    return { org, root, a, a1, b };
  }

  const pendingIn = (org: string, recommenderId: string) =>
    createPartner(testDb, org, { recommenderId, state: 'PENDING_ACTIVATION' });

  const stateOf = async (org: string, id: string) => {
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

  describe('activation and deactivation', () => {
    it('lets the Platinum of the organization activate a pending partner', async () => {
      const { org, root } = await newOrg();
      const pending = await pendingIn(org, root.accountId);

      const body = await gql(await agentFor(root.email), ACTIVATE, {
        id: pending.accountId,
      });

      expect(body.errors).toBeUndefined();
      expect(body.data!.activateAccount.state).toBe('ACTIVE');
      expect((await stateOf(org, pending.accountId)).state).toBe('ACTIVE');
      const [entry] = await auditFor(pending.accountId, 'account.activate');
      expect(entry).toMatchObject({
        actorAccountId: root.accountId,
        before: { state: 'PENDING_ACTIVATION' },
        after: { state: 'ACTIVE' },
      });
    });

    it('refuses to activate an account that is already active', async () => {
      const { root, a } = await newOrg();

      const body = await gql(await agentFor(root.email), ACTIVATE, {
        id: a.accountId,
      });

      expect(errorOf(body)).toMatchObject({
        code: 'FORBIDDEN',
        reason: 'invalid_state',
      });
    });

    it('cuts a deactivated account off at once and kills its links', async () => {
      const { root, a } = await newOrg();
      const partner = await agentFor(a.email);
      const created = await gql(partner, CREATE_INVITATION, {
        input: { kind: 'PARTNER', recipientEmail: uniqueEmail() },
      });
      const token = created.data!.createInvitation.url.split('/register/')[1];
      expect(
        (await gql(anonymous(), PREVIEW, { token })).data!.invitation,
      ).not.toBeNull();
      expect((await gql(partner, MINE)).errors).toBeUndefined();

      const body = await gql(await agentFor(root.email), DEACTIVATE, {
        id: a.accountId,
      });

      expect(body.data!.deactivateAccount.state).toBe('DEACTIVATED');
      // The session the partner already had stopped working.
      expect(errorOf(await gql(partner, MINE))?.code).toBe('UNAUTHENTICATED');
      // A new login is refused, and the link it created is dead (decision 73).
      const login = await gql(anonymous(), LOGIN, {
        email: a.email,
        password: TEST_PASSWORD,
      });
      expect(errorOf(login)?.code).toBe('ACCOUNT_DEACTIVATED');
      expect(
        (await gql(anonymous(), PREVIEW, { token })).data!.invitation,
      ).toBe(null);
      const [entry] = await auditFor(a.accountId, 'account.deactivate');
      expect(entry?.after).toEqual({ state: 'DEACTIVATED' });
    });

    it('reactivates a deactivated account without changing role or status', async () => {
      const { org, root, a } = await newOrg();
      const rootAgent = await agentFor(root.email);
      await gql(rootAgent, ROLE, { id: a.accountId, role: 'SILVER' });
      await gql(rootAgent, DEACTIVATE, { id: a.accountId });

      const body = await gql(rootAgent, ACTIVATE, { id: a.accountId });

      expect(body.data!.activateAccount).toMatchObject({
        state: 'ACTIVE',
        role: 'SILVER',
      });
      expect((await stateOf(org, a.accountId)).role).toBe('SILVER');
    });

    it('does not let an ordinary partner activate anybody', async () => {
      const { org, a, a1 } = await newOrg();
      const pending = await pendingIn(org, a1.accountId);

      const body = await gql(await agentFor(a.email), ACTIVATE, {
        id: pending.accountId,
      });

      expect(errorOf(body)).toMatchObject({
        code: 'FORBIDDEN',
        reason: 'insufficient_role',
      });
    });

    it('does not let anybody deactivate themselves', async () => {
      const { root } = await newOrg();

      const body = await gql(await agentFor(root.email), DEACTIVATE, {
        id: root.accountId,
      });

      expect(errorOf(body)).toMatchObject({
        code: 'FORBIDDEN',
        reason: 'self',
      });
    });

    it('hides accounts of another organization and unknown ids alike', async () => {
      const { root } = await newOrg();
      const other = await newOrg();
      const agent = await agentFor(root.email);

      const foreign = await gql(agent, DEACTIVATE, { id: other.a.accountId });
      const unknown = await gql(agent, DEACTIVATE, {
        id: '00000000-0000-4000-8000-000000000000',
      });
      const garbage = await gql(agent, DEACTIVATE, { id: 'not-an-id' });

      for (const body of [foreign, unknown, garbage]) {
        expect(errorOf(body)?.code).toBe('NOT_FOUND');
      }
      expect((await stateOf(other.org, other.a.accountId)).state).toBe(
        'ACTIVE',
      );
    });

    it('lets an Administrator act in their downline and nowhere else', async () => {
      const { org, root, a, a1, b } = await newOrg();
      await gql(await agentFor(root.email), ROLE, {
        id: a.accountId,
        role: 'SILVER',
      });
      // Only a SuperAdministrator makes Administrators.
      const superAdmin = await createSuperAdmin(testDb);
      await gql(await agentFor(superAdmin.email), ROLE, {
        id: a.accountId,
        role: 'ADMINISTRATOR',
      });
      const admin = await agentFor(a.email);

      const below = await gql(admin, DEACTIVATE, { id: a1.accountId });
      const beside = await gql(admin, DEACTIVATE, { id: b.accountId });

      expect(below.data!.deactivateAccount.state).toBe('DEACTIVATED');
      expect(errorOf(beside)?.code).toBe('NOT_FOUND');
      expect((await stateOf(org, b.accountId)).state).toBe('ACTIVE');
    });

    it('serializes two simultaneous deactivations: one wins, one is refused', async () => {
      const { root, a } = await newOrg();
      const first = await agentFor(root.email);
      const second = await agentFor(root.email);

      const [x, y] = await Promise.all([
        gql(first, DEACTIVATE, { id: a.accountId }),
        gql(second, DEACTIVATE, { id: a.accountId }),
      ]);

      const failures = [x, y].filter((body) => body.errors);
      expect(failures).toHaveLength(1);
      expect(errorOf(failures[0]!)).toMatchObject({
        code: 'FORBIDDEN',
        reason: 'invalid_state',
      });
      expect(await auditFor(a.accountId, 'account.deactivate')).toHaveLength(1);
    });
  });

  describe('role and status', () => {
    it('lets a Platinum change a role inside their organization and records it', async () => {
      const { org, root, a } = await newOrg();

      const body = await gql(await agentFor(root.email), ROLE, {
        id: a.accountId,
        role: 'SILVER',
      });

      expect(body.data!.changeAccountRole.role).toBe('SILVER');
      expect((await stateOf(org, a.accountId)).role).toBe('SILVER');
      const { roleHistory } = orgTables(org);
      const history = await testDb.db
        .select()
        .from(roleHistory)
        .where(eq(roleHistory.accountId, a.accountId));
      expect(history.map((h) => h.role)).toContain('SILVER');
      expect(history.find((h) => h.role === 'SILVER')?.changedBy).toBe(
        root.accountId,
      );
      const [entry] = await auditFor(a.accountId, 'account.role.change');
      expect(entry).toMatchObject({
        before: { role: 'GENERAL' },
        after: { role: 'SILVER' },
      });
    });

    it('does nothing, and writes nothing, when the role is unchanged', async () => {
      const { org, root, a } = await newOrg();
      const agent = await agentFor(root.email);
      await gql(agent, ROLE, { id: a.accountId, role: 'BUILDER' });
      const { roleHistory } = orgTables(org);
      const before = await testDb.db
        .select()
        .from(roleHistory)
        .where(eq(roleHistory.accountId, a.accountId));

      const body = await gql(agent, ROLE, { id: a.accountId, role: 'BUILDER' });

      expect(body.errors).toBeUndefined();
      const after = await testDb.db
        .select()
        .from(roleHistory)
        .where(eq(roleHistory.accountId, a.accountId));
      expect(after).toHaveLength(before.length);
      expect(await auditFor(a.accountId, 'account.role.change')).toHaveLength(
        1,
      );
    });

    it('keeps the special roles out of reach of a Platinum', async () => {
      const { root, a } = await newOrg();
      const agent = await agentFor(root.email);

      const admin = await gql(agent, ROLE, {
        id: a.accountId,
        role: 'ADMINISTRATOR',
      });
      const platinum = await gql(agent, ROLE, {
        id: a.accountId,
        role: 'PLATINUM',
      });
      const superAdmin = await gql(agent, ROLE, {
        id: a.accountId,
        role: 'SUPER_ADMINISTRATOR',
      });

      expect(errorOf(admin)?.reason).toBe('role_not_assignable');
      expect(errorOf(platinum)?.reason).toBe('use_promote');
      expect(errorOf(superAdmin)?.reason).toBe('role_not_assignable');
    });

    it('lets only a SuperAdministrator grant Administrator', async () => {
      const { a } = await newOrg();
      const superAdmin = await createSuperAdmin(testDb);

      const body = await gql(await agentFor(superAdmin.email), ROLE, {
        id: a.accountId,
        role: 'ADMINISTRATOR',
      });

      expect(body.data!.changeAccountRole.role).toBe('ADMINISTRATOR');
    });

    it('does not let an ordinary partner or an outsider change roles', async () => {
      const { a, a1 } = await newOrg();
      const other = await newOrg();

      const ordinary = await gql(await agentFor(a.email), ROLE, {
        id: a1.accountId,
        role: 'FOUNDATION',
      });
      const outsider = await gql(await agentFor(other.root.email), ROLE, {
        id: a1.accountId,
        role: 'FOUNDATION',
      });

      expect(errorOf(ordinary)?.reason).toBe('insufficient_role');
      expect(errorOf(outsider)?.code).toBe('NOT_FOUND');
    });

    it('does not let anybody change their own role', async () => {
      const { root } = await newOrg();

      const body = await gql(await agentFor(root.email), ROLE, {
        id: root.accountId,
        role: 'SILVER',
      });

      expect(errorOf(body)?.reason).toBe('self');
    });

    it('lets a Platinum change the status of a partner, not an ordinary partner', async () => {
      const { org, root, a, a1 } = await newOrg();

      const ok = await gql(await agentFor(root.email), STATUS, {
        id: a.accountId,
        status: 'GO_MAGIC',
      });
      const refused = await gql(await agentFor(a.email), STATUS, {
        id: a1.accountId,
        status: 'GO_MAGIC',
      });

      expect(ok.data!.changeAccountStatus.status).toBe('GO_MAGIC');
      expect((await stateOf(org, a.accountId)).status).toBe('GO_MAGIC');
      expect(errorOf(refused)?.reason).toBe('insufficient_role');
      const [entry] = await auditFor(a.accountId, 'account.status.change');
      expect(entry).toMatchObject({
        before: { status: 'INACTIVE' },
        after: { status: 'GO_MAGIC' },
      });
    });

    it('works on an account that still awaits activation', async () => {
      const { org, root } = await newOrg();
      const pending = await pendingIn(org, root.accountId);

      const body = await gql(await agentFor(root.email), ROLE, {
        id: pending.accountId,
        role: 'FOUNDATION',
      });

      expect(body.data!.changeAccountRole).toMatchObject({
        role: 'FOUNDATION',
        state: 'PENDING_ACTIVATION',
      });
    });
  });

  describe('the profile of the owner', () => {
    it('does not complete without consents or with a missing field', async () => {
      const { org, root } = await newOrg();
      const withoutConsent = await pendingIn(org, root.accountId);
      const withoutPhone = await pendingIn(org, root.accountId);

      const noConsent = await gql(
        await agentFor(withoutConsent.email),
        PROFILE,
        { input: { ...GOOD_PROFILE, acceptConsents: false } },
      );
      const noPhone = await gql(await agentFor(withoutPhone.email), PROFILE, {
        input: { firstName: 'Anna', lastName: 'Nowak', acceptConsents: true },
      });

      expect(noConsent.data!.updateMyProfile.profileCompletedAt).toBeNull();
      expect(noPhone.data!.updateMyProfile.profileCompletedAt).toBeNull();
      expect(await queuedFor(root.email)).toHaveLength(0);
    });

    it('completes once everything is there and tells the Platinum, once', async () => {
      const { org, root } = await newOrg();
      const pending = await pendingIn(org, root.accountId);
      const agent = await agentFor(pending.email);

      const body = await gql(agent, PROFILE, { input: GOOD_PROFILE });
      // Saving again must not send a second message.
      await gql(agent, PROFILE, { input: { firstName: 'Anna Maria' } });

      expect(body.errors).toBeUndefined();
      expect(body.data!.updateMyProfile).toMatchObject({
        firstName: 'Anna',
        lastName: 'Nowak',
        phone: '+48600100200',
        state: 'PENDING_ACTIVATION',
      });
      expect(body.data!.updateMyProfile.profileCompletedAt).not.toBeNull();
      expect(body.data!.updateMyProfile.consentsAcceptedAt).not.toBeNull();

      const queued = await queuedFor(root.email);
      expect(queued).toHaveLength(1);
      expect(queued[0]).toMatchObject({
        type: 'profileCompleted',
        status: 'PENDING',
      });

      await dispatchUntil(app, () => mailbox.some((m) => m.to === root.email));
      const mail = mailbox.find((m) => m.to === root.email);
      expect(mail?.subject).toBe('Profil uzupełniony: Anna Nowak');
      expect(mail?.text).toContain(`/accounts/${pending.accountId}`);

      const shown = await gql(agent, MY_PROFILE);
      expect(shown.data!.myProfile).toMatchObject({
        email: pending.email,
        firstName: 'Anna Maria',
        partnerCountry: null,
      });
      const root_ = await gql(await agentFor(root.email), ACCOUNT, {
        id: pending.accountId,
      });
      expect(root_.data!.account.profileCompleted).toBe(true);
    });

    it('tells the SuperAdministrators when the Platinum completes their own profile', async () => {
      const superAdmin = await createSuperAdmin(testDb);
      const { root } = await createOrgWithRoot(testDb, {
        state: 'PENDING_ACTIVATION',
      });

      const body = await gql(await agentFor(root.email), PROFILE, {
        input: GOOD_PROFILE,
      });

      expect(body.errors).toBeUndefined();
      const queued = await queuedFor(superAdmin.email);
      expect(queued).toHaveLength(1);
      expect(queued[0]?.type).toBe('profileCompleted');
      // Nobody is above the root inside the organization.
      expect(await queuedFor(root.email)).toHaveLength(0);
    });

    it('falls back to the SuperAdministrators when the Platinum is not active', async () => {
      const superAdmin = await createSuperAdmin(testDb);
      const { org, root } = await createOrgWithRoot(testDb, {
        state: 'DEACTIVATED',
      });
      const pending = await pendingIn(org, root.accountId);

      await gql(await agentFor(pending.email), PROFILE, {
        input: GOOD_PROFILE,
      });

      expect(await queuedFor(root.email)).toHaveLength(0);
      expect(await queuedFor(superAdmin.email)).not.toHaveLength(0);
    });

    it('rejects bad values and names the field', async () => {
      const { org, root } = await newOrg();
      const pending = await pendingIn(org, root.accountId);
      const agent = await agentFor(pending.email);

      const phone = await gql(agent, PROFILE, { input: { phone: 'abc' } });
      const name = await gql(agent, PROFILE, { input: { firstName: '   ' } });

      expect(errorOf(phone)).toMatchObject({
        code: 'VALIDATION_FAILED',
        field: 'phone',
      });
      expect(errorOf(name)).toMatchObject({
        code: 'VALIDATION_FAILED',
        field: 'firstName',
      });
    });

    it('has no profile for a SuperAdministrator', async () => {
      const superAdmin = await createSuperAdmin(testDb);
      const agent = await agentFor(superAdmin.email);

      const update = await gql(agent, PROFILE, { input: GOOD_PROFILE });
      const mine = await gql(agent, MY_PROFILE);

      expect(errorOf(update)?.code).toBe('FORBIDDEN');
      expect(mine.data!.myProfile).toBeNull();
    });
  });

  describe("somebody else's data", () => {
    it('lets a Platinum correct name and phone, but not an ordinary partner', async () => {
      const { org, root, a, a1 } = await newOrg();

      const ok = await gql(await agentFor(root.email), DATA, {
        id: a.accountId,
        input: { firstName: 'Jan', lastName: 'Kowalski', phone: '600 111 222' },
      });
      const refused = await gql(await agentFor(a.email), DATA, {
        id: a1.accountId,
        input: { firstName: 'Jan' },
      });

      expect(ok.data!.updateAccountData).toMatchObject({
        firstName: 'Jan',
        lastName: 'Kowalski',
        phone: '600111222',
      });
      expect((await stateOf(org, a.accountId)).firstName).toBe('Jan');
      expect(errorOf(refused)?.reason).toBe('insufficient_role');
      const [entry] = await auditFor(a.accountId, 'account.update');
      expect(entry?.after).toMatchObject({ firstName: 'Jan' });
    });

    it('refuses your own account here (use the profile) and strangers', async () => {
      const { root } = await newOrg();
      const other = await newOrg();
      const agent = await agentFor(root.email);

      const self = await gql(agent, DATA, {
        id: root.accountId,
        input: { firstName: 'X' },
      });
      const foreign = await gql(agent, DATA, {
        id: other.a.accountId,
        input: { firstName: 'X' },
      });

      expect(errorOf(self)?.reason).toBe('self');
      expect(errorOf(foreign)?.code).toBe('NOT_FOUND');
    });

    it('lets only a SuperAdministrator change the Partner number, keeping it unique', async () => {
      const { root, a, b } = await newOrg();
      const superAdmin = await createSuperAdmin(testDb);
      const number = String(Math.floor(Math.random() * 9e8) + 1e8);
      const admin = await agentFor(superAdmin.email);

      const ok = await gql(admin, PNUM, {
        id: a.accountId,
        input: {
          country: 'de',
          partnerNumber: ` ${number.slice(0, 3)} ${number.slice(3)} `,
        },
      });
      const taken = await gql(admin, PNUM, {
        id: b.accountId,
        input: { country: 'DE', partnerNumber: number },
      });
      const sameElsewhere = await gql(admin, PNUM, {
        id: b.accountId,
        input: { country: 'PL', partnerNumber: number },
      });
      const bad = await gql(admin, PNUM, {
        id: b.accountId,
        input: { partnerNumber: '12-34' },
      });
      const platinum = await gql(await agentFor(root.email), PNUM, {
        id: a.accountId,
        input: { partnerNumber: '999888777' },
      });

      expect(ok.data!.updatePartnerNumber).toMatchObject({
        partnerNumber: number,
        partnerCountry: 'DE',
      });
      expect(errorOf(taken)?.code).toBe('PARTNER_NUMBER_TAKEN');
      // The same digits in another country are another number.
      expect(sameElsewhere.errors).toBeUndefined();
      expect(errorOf(bad)).toMatchObject({
        code: 'VALIDATION_FAILED',
        field: 'partnerNumber',
      });
      expect(errorOf(platinum)?.reason).toBe('insufficient_role');
      const [row] = await testDb.db
        .select()
        .from(accounts)
        .where(eq(accounts.id, a.accountId));
      expect(row).toMatchObject({
        partnerNumber: number,
        partnerCountry: 'DE',
      });
      const [entry] = await auditFor(
        a.accountId,
        'account.partner_number.change',
      );
      expect(entry?.after).toEqual({
        partnerNumber: number,
        partnerCountry: 'DE',
      });
    });
  });

  describe('the structure', () => {
    it('shows a Platinum themselves and the organization, parents before children', async () => {
      const { root, a, a1, b } = await newOrg();
      const other = await newOrg();

      const body = await gql(await agentFor(root.email), STRUCTURE);

      const rows = body.data!.structure as {
        depth: number;
        account: { id: string; isOrgRoot: boolean };
      }[];
      expect(rows.map((r) => [r.account.id, r.depth])).toEqual([
        [root.accountId, 0],
        [a.accountId, 1],
        [a1.accountId, 2],
        [b.accountId, 1],
      ]);
      expect(rows[0]!.account.isOrgRoot).toBe(true);
      expect(rows.some((r) => r.account.id === other.root.accountId)).toBe(
        false,
      );
    });

    it('shows an ordinary partner only their own branch', async () => {
      const { a, a1 } = await newOrg();

      const body = await gql(await agentFor(a.email), STRUCTURE);

      expect(
        body.data!.structure.map(
          (r: { account: { id: string } }) => r.account.id,
        ),
      ).toEqual([a.accountId, a1.accountId]);
    });

    it('shows a SuperAdministrator every organization', async () => {
      const first = await newOrg();
      const second = await newOrg();
      const superAdmin = await createSuperAdmin(testDb);

      const body = await gql(await agentFor(superAdmin.email), STRUCTURE);

      const ids = body.data!.structure.map(
        (r: { account: { id: string } }) => r.account.id,
      ) as string[];
      for (const id of [
        first.root.accountId,
        first.a1.accountId,
        second.root.accountId,
        second.b.accountId,
      ]) {
        expect(ids).toContain(id);
      }
      expect(ids.indexOf(first.root.accountId)).toBeLessThan(
        ids.indexOf(first.a.accountId),
      );
    });

    it('is closed to an account that awaits activation', async () => {
      const { org, root } = await newOrg();
      const pending = await pendingIn(org, root.accountId);

      const body = await gql(await agentFor(pending.email), STRUCTURE);

      expect(errorOf(body)).toMatchObject({
        code: 'FORBIDDEN',
        reason: 'actor_not_active',
      });
    });

    it('says what the caller may do with each account', async () => {
      const { org, root, a } = await newOrg();
      const pending = await pendingIn(org, root.accountId);

      const body = await gql(await agentFor(root.email), STRUCTURE);

      const byId = new Map(
        body.data!.structure.map(
          (r: {
            account: {
              id: string;
              allowedActions: string[];
              assignableRoles: string[];
            };
          }) => [r.account.id, r.account],
        ),
      );
      const self = byId.get(root.accountId) as { allowedActions: string[] };
      const active = byId.get(a.accountId) as {
        allowedActions: string[];
        assignableRoles: string[];
      };
      const waiting = byId.get(pending.accountId) as {
        allowedActions: string[];
      };
      expect(self.allowedActions).toEqual([]);
      expect(active.allowedActions).toEqual([
        'DEACTIVATE',
        'CHANGE_ROLE',
        'CHANGE_STATUS',
        'UPDATE_ACCOUNT',
        'CHANGE_RECOMMENDER',
        'REMOVE_FROM_STRUCTURE',
        'PROMOTE',
      ]);
      expect(active.assignableRoles).toEqual([
        'FOUNDATION',
        'BUILDER',
        'SILVER',
      ]);
      expect(waiting.allowedActions).toContain('ACTIVATE');
    });

    it('offers a SuperAdministrator the Partner number and the Administrator role', async () => {
      const { a } = await newOrg();
      const superAdmin = await createSuperAdmin(testDb);

      const body = await gql(await agentFor(superAdmin.email), ACCOUNT, {
        id: a.accountId,
      });

      expect(body.data!.account.allowedActions).toContain(
        'CHANGE_PARTNER_NUMBER',
      );
      expect(body.data!.account.assignableRoles).toContain('ADMINISTRATOR');
    });

    it('returns an account only to somebody who may see it', async () => {
      const { root, a, a1, b } = await newOrg();
      const other = await newOrg();

      const own = await gql(await agentFor(a.email), ACCOUNT, {
        id: a.accountId,
      });
      const below = await gql(await agentFor(a.email), ACCOUNT, {
        id: a1.accountId,
      });
      const beside = await gql(await agentFor(a.email), ACCOUNT, {
        id: b.accountId,
      });
      const above = await gql(await agentFor(a.email), ACCOUNT, {
        id: root.accountId,
      });
      const foreign = await gql(await agentFor(root.email), ACCOUNT, {
        id: other.a.accountId,
      });

      expect(own.data!.account.id).toBe(a.accountId);
      expect(below.data!.account.id).toBe(a1.accountId);
      expect(beside.data!.account).toBeNull();
      expect(above.data!.account).toBeNull();
      expect(foreign.data!.account).toBeNull();
    });
  });

  describe('revoking an invitation', () => {
    const create = async (agent: Agent) => {
      const body = await gql(agent, CREATE_INVITATION, {
        input: { kind: 'PARTNER', recipientEmail: uniqueEmail() },
      });
      expect(body.errors).toBeUndefined();
      const { url, invitation } = body.data!.createInvitation;
      return { id: invitation.id as string, token: url.split('/register/')[1] };
    };

    it('lets the author revoke a link, which then stops working', async () => {
      const { a } = await newOrg();
      const agent = await agentFor(a.email);
      const { id, token } = await create(agent);

      const body = await gql(agent, REVOKE, { id });

      expect(body.data!.revokeInvitation).toEqual({ id, status: 'EXPIRED' });
      expect(
        (await gql(anonymous(), PREVIEW, { token })).data!.invitation,
      ).toBe(null);
      const mine = await gql(agent, MINE);
      expect(mine.data!.myInvitations).toContainEqual({
        id,
        status: 'EXPIRED',
      });
      expect(await auditFor(a.accountId, 'invitation.revoke')).toHaveLength(1);
    });

    it('lets a SuperAdministrator revoke, but not another partner', async () => {
      const { a, b } = await newOrg();
      const { id } = await create(await agentFor(a.email));
      const superAdmin = await createSuperAdmin(testDb);

      const stranger = await gql(await agentFor(b.email), REVOKE, { id });
      const admin = await gql(await agentFor(superAdmin.email), REVOKE, { id });

      expect(errorOf(stranger)).toMatchObject({
        code: 'FORBIDDEN',
        reason: 'not_in_scope',
      });
      expect(admin.data!.revokeInvitation.status).toBe('EXPIRED');
    });

    it('cannot revoke a link that is used, already revoked or unknown', async () => {
      const { a } = await newOrg();
      const agent = await agentFor(a.email);
      const used = await create(agent);
      await testDb.db
        .update(invitations)
        .set({ consumedAt: new Date(), consumedByAccountId: a.accountId })
        .where(eq(invitations.id, used.id));
      const revoked = await create(agent);
      await gql(agent, REVOKE, { id: revoked.id });

      expect(errorOf(await gql(agent, REVOKE, { id: used.id }))?.code).toBe(
        'INVITATION_INVALID',
      );
      expect(errorOf(await gql(agent, REVOKE, { id: revoked.id }))?.code).toBe(
        'INVITATION_INVALID',
      );
      expect(
        errorOf(
          await gql(agent, REVOKE, {
            id: '00000000-0000-4000-8000-000000000000',
          }),
        )?.code,
      ).toBe('NOT_FOUND');
    });
  });

  describe('the invitation e-mail', () => {
    it('names the inviter when they have given a name', async () => {
      const { org, root } = await newOrg();
      const named = await createPartner(testDb, org, {
        recommenderId: root.accountId,
        firstName: 'Ewa',
        lastName: 'Zielińska',
      });
      const recipient = uniqueEmail();

      await gql(await agentFor(named.email), CREATE_INVITATION, {
        input: { kind: 'PARTNER', recipientEmail: recipient, sendEmail: true },
      });
      await dispatchUntil(app, () => mailbox.some((m) => m.to === recipient));

      expect(mailbox.find((m) => m.to === recipient)?.text).toContain(
        'Zaprasza Cię: Ewa Zielińska.',
      );
    });
  });
});
