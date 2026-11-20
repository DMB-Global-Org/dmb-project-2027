import type { INestApplication } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import request from 'supertest';
import {
  type Agent,
  createTestApp,
  errorOf,
  gql,
} from '../../test/support/app.js';
import {
  createOrg,
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
  orgSchemas,
} from '../db/schema/index.js';
import { hashInvitationToken } from './invitation-token.js';

const CREATE = `mutation ($input: CreateInvitationInput!) {
  createInvitation(input: $input) {
    url
    invitation { id kind status recipientEmail recipientPhone locale createdAt expiresAt }
  }
}`;
const MINE = '{ myInvitations { id status kind } }';
const PREVIEW = `query ($token: String!) {
  invitation(token: $token) { kind recipientEmail recipientPhone locale expiresAt }
}`;
const REGISTER = `mutation ($input: RegisterInput!) {
  register(input: $input) { id email role state locale }
}`;
const VIEWER = '{ viewer { id email role state } }';
const LOGIN = `mutation ($email: String!, $password: String!) {
  login(email: $email, password: $password) { id }
}`;

const HOUR_MS = 60 * 60 * 1000;
const tokenOf = (url: string) => url.split('/register/')[1]!;

describe('invitations and registration (integration)', () => {
  let app: INestApplication;
  let testDb: TestDb;

  const anonymous = () => request(app.getHttpServer());
  const agentFor = async (email: string): Promise<Agent> => {
    const agent = request.agent(app.getHttpServer());
    const body = await gql(agent, LOGIN, { email, password: TEST_PASSWORD });
    expect(body.errors).toBeUndefined();
    return agent;
  };

  /** Organization with a Platinum root and an active partner `a` below it. */
  async function newOrg() {
    const org = await createOrg(testDb);
    const root = await createPartner(testDb, org, { role: 'PLATINUM' });
    const a = await createPartner(testDb, org, {
      recommenderId: root.accountId,
    });
    return { org, root, a };
  }

  /** Creates a link as `agent`; returns its token. */
  async function link(
    agent: Agent,
    input: Record<string, unknown> = {},
  ): Promise<{ token: string; id: string }> {
    const body = await gql(agent, CREATE, {
      input: {
        kind: 'PARTNER',
        recipientEmail: uniqueEmail(),
        ...input,
      },
    });
    expect(body.errors).toBeUndefined();
    const created = body.data!.createInvitation;
    return { token: tokenOf(created.url), id: created.invitation.id };
  }

  const form = (token: string, overrides: Record<string, unknown> = {}) => ({
    token,
    email: uniqueEmail(),
    password: 'a long enough password',
    passwordConfirmation: 'a long enough password',
    partnerNumber: String(Math.floor(Math.random() * 1e9) + 1e8),
    ...overrides,
  });

  const register = (
    client: Agent,
    token: string,
    overrides: Record<string, unknown> = {},
  ) => gql(client, REGISTER, { input: form(token, overrides) });

  const expire = (id: string) =>
    testDb.db
      .update(invitations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invitations.id, id));

  beforeAll(async () => {
    testDb = createTestDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await testDb.close();
  });

  describe('creating a link', () => {
    it('needs a logged-in account', async () => {
      const body = await gql(anonymous(), CREATE, {
        input: { kind: 'PARTNER', recipientEmail: 'x@example.com' },
      });
      expect(errorOf(body)?.code).toBe('UNAUTHENTICATED');
    });

    it('lets any activated partner invite with themselves as sponsor', async () => {
      const { a } = await newOrg();
      const agent = await agentFor(a.email);

      const body = await gql(agent, CREATE, {
        input: {
          kind: 'PARTNER',
          recipientPhone: '+48 600 100 200',
          locale: 'de',
        },
      });

      expect(body.errors).toBeUndefined();
      const { url, invitation } = body.data!.createInvitation;
      expect(url).toMatch(/\/register\/[\w-]{43}$/);
      expect(invitation).toMatchObject({
        kind: 'PARTNER',
        status: 'PENDING',
        recipientPhone: '+48 600 100 200',
        recipientEmail: null,
        locale: 'de',
      });
      const lifetime =
        Date.parse(invitation.expiresAt) - Date.parse(invitation.createdAt);
      expect(lifetime).toBe(72 * HOUR_MS);
    });

    it('stores only a hash of the token', async () => {
      const { a } = await newOrg();
      const { token, id } = await link(await agentFor(a.email));

      const [row] = await testDb.db
        .select()
        .from(invitations)
        .where(eq(invitations.id, id));
      expect(row?.tokenHash).toBe(hashInvitationToken(token));
      expect(row?.tokenHash).not.toBe(token);
    });

    it('lets the inviter name somebody below them as the sponsor', async () => {
      const { root, a } = await newOrg();
      const agent = await agentFor(root.email);

      const { id } = await link(agent, { recommenderId: a.accountId });

      const [row] = await testDb.db
        .select()
        .from(invitations)
        .where(eq(invitations.id, id));
      expect(row?.recommenderAccountId).toBe(a.accountId);
      expect(row?.inviterAccountId).toBe(root.accountId);
    });

    it.each([
      ['somebody above them', 'above'],
      ['somebody beside them', 'beside'],
    ])('refuses a sponsor who is %s', async (_label, where) => {
      const { org, root, a } = await newOrg();
      const sibling = await createPartner(testDb, org, {
        recommenderId: root.accountId,
      });
      const agent = await agentFor(a.email);

      const body = await gql(agent, CREATE, {
        input: {
          kind: 'PARTNER',
          recipientEmail: uniqueEmail(),
          recommenderId: where === 'above' ? root.accountId : sibling.accountId,
        },
      });
      expect(errorOf(body)).toMatchObject({
        code: 'FORBIDDEN',
        reason: 'not_in_scope',
      });
    });

    it('refuses a sponsor from another organization and an unknown one alike', async () => {
      const { a } = await newOrg();
      const foreign = (await newOrg()).a;
      const agent = await agentFor(a.email);

      for (const recommenderId of [
        foreign.accountId,
        '00000000-0000-4000-8000-000000000000',
      ]) {
        const body = await gql(agent, CREATE, {
          input: {
            kind: 'PARTNER',
            recipientEmail: uniqueEmail(),
            recommenderId,
          },
        });
        expect(errorOf(body)).toMatchObject({
          code: 'FORBIDDEN',
          reason: 'not_in_scope',
        });
      }
    });

    it('refuses a sponsor who cannot operate', async () => {
      const { org, root } = await newOrg();
      const sleeping = await createPartner(testDb, org, {
        recommenderId: root.accountId,
        state: 'DEACTIVATED',
      });

      const body = await gql(await agentFor(root.email), CREATE, {
        input: {
          kind: 'PARTNER',
          recipientEmail: uniqueEmail(),
          recommenderId: sleeping.accountId,
        },
      });
      expect(errorOf(body)).toMatchObject({
        code: 'FORBIDDEN',
        reason: 'recommender_not_active',
      });
    });

    it('refuses an account that still awaits activation', async () => {
      const { org, root } = await newOrg();
      const pending = await createPartner(testDb, org, {
        recommenderId: root.accountId,
        state: 'PENDING_ACTIVATION',
      });

      const body = await gql(await agentFor(pending.email), CREATE, {
        input: { kind: 'PARTNER', recipientEmail: uniqueEmail() },
      });
      expect(errorOf(body)).toMatchObject({
        code: 'FORBIDDEN',
        reason: 'actor_not_active',
      });
    });

    it('lets only a SuperAdministrator invite a Platinum', async () => {
      const { root } = await newOrg();
      const superAdmin = await createSuperAdmin(testDb);
      const input = { kind: 'PLATINUM', recipientEmail: uniqueEmail() };

      const denied = await gql(await agentFor(root.email), CREATE, { input });
      expect(errorOf(denied)).toMatchObject({
        code: 'FORBIDDEN',
        reason: 'insufficient_role',
      });

      const allowed = await gql(await agentFor(superAdmin.email), CREATE, {
        input,
      });
      expect(allowed.errors).toBeUndefined();
      expect(allowed.data!.createInvitation.invitation.kind).toBe('PLATINUM');
    });

    it('does not take a sponsor for a Platinum link', async () => {
      const { a } = await newOrg();
      const superAdmin = await createSuperAdmin(testDb);

      const body = await gql(await agentFor(superAdmin.email), CREATE, {
        input: {
          kind: 'PLATINUM',
          recipientEmail: uniqueEmail(),
          recommenderId: a.accountId,
        },
      });
      expect(errorOf(body)).toMatchObject({
        code: 'VALIDATION_FAILED',
        field: 'recommenderId',
      });
    });

    it('makes a SuperAdministrator name the sponsor of a Partner link', async () => {
      const { a } = await newOrg();
      const agent = await agentFor((await createSuperAdmin(testDb)).email);
      const input = { kind: 'PARTNER', recipientEmail: uniqueEmail() };

      const missing = await gql(agent, CREATE, { input });
      expect(errorOf(missing)).toMatchObject({
        code: 'VALIDATION_FAILED',
        field: 'recommenderId',
      });

      const named = await gql(agent, CREATE, {
        input: { ...input, recommenderId: a.accountId },
      });
      expect(named.errors).toBeUndefined();
    });

    it.each([
      ['no recipient', {}],
      ['a malformed e-mail address', { recipientEmail: 'nope' }],
      ['a malformed phone number', { recipientPhone: 'call me' }],
      ['an unsupported language', { recipientEmail: 'a@b.pl', locale: 'fr' }],
    ])('rejects %s', async (_label, extra) => {
      const { a } = await newOrg();

      const body = await gql(await agentFor(a.email), CREATE, {
        input: { kind: 'PARTNER', ...extra },
      });
      expect(errorOf(body)?.code).toBe('VALIDATION_FAILED');
    });

    it('writes the system log', async () => {
      const { a } = await newOrg();
      const { id } = await link(await agentFor(a.email));

      const entries = await testDb.db
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.objectId, id),
            eq(auditLog.action, 'invitation.create'),
          ),
        );
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        actorAccountId: a.accountId,
        objectType: 'invitation',
      });
      expect(JSON.stringify(entries[0])).not.toContain(
        // the log never carries the link itself
        'register/',
      );
    });
  });

  describe('listing own links', () => {
    it('shows pending, used and expired links of the caller only', async () => {
      const { a, root } = await newOrg();
      const agent = await agentFor(a.email);
      const pending = await link(agent);
      const expired = await link(agent);
      const used = await link(agent);
      await expire(expired.id);
      await register(anonymous(), used.token);
      await link(await agentFor(root.email)); // somebody else's

      const body = await gql(agent, MINE);

      const statuses = Object.fromEntries(
        body.data!.myInvitations.map((i: { id: string; status: string }) => [
          i.id,
          i.status,
        ]),
      );
      expect(statuses).toEqual({
        [pending.id]: 'PENDING',
        [expired.id]: 'EXPIRED',
        [used.id]: 'USED',
      });
    });
  });

  describe('opening a link', () => {
    it('shows what the registration page needs, without logging in', async () => {
      const { a } = await newOrg();
      const { token } = await link(await agentFor(a.email), {
        recipientEmail: 'jan@example.com',
        locale: 'en',
      });

      const body = await gql(anonymous(), PREVIEW, { token });

      expect(body.data!.invitation).toMatchObject({
        kind: 'PARTNER',
        recipientEmail: 'jan@example.com',
        locale: 'en',
      });
    });

    it('can be opened many times (decision 75)', async () => {
      const { a } = await newOrg();
      const { token } = await link(await agentFor(a.email));

      for (let i = 0; i < 3; i++) {
        const body = await gql(anonymous(), PREVIEW, { token });
        expect(body.data!.invitation).not.toBeNull();
      }
    });

    it('says nothing about a link that is unknown, expired or used', async () => {
      const { a } = await newOrg();
      const agent = await agentFor(a.email);
      const expired = await link(agent);
      const used = await link(agent);
      await expire(expired.id);
      await register(anonymous(), used.token);

      for (const token of ['unknown', expired.token, used.token]) {
        const body = await gql(anonymous(), PREVIEW, { token });
        expect(body.errors).toBeUndefined();
        expect(body.data!.invitation).toBeNull();
      }
    });

    it('stops working once its inviter is deactivated (decision 73)', async () => {
      const { org, a } = await newOrg();
      const { token } = await link(await agentFor(a.email));

      await testDb.db
        .update(orgTables(org).partners)
        .set({ state: 'DEACTIVATED' })
        .where(eq(orgTables(org).partners.accountId, a.accountId));

      const body = await gql(anonymous(), PREVIEW, { token });
      expect(body.data!.invitation).toBeNull();
    });
  });

  describe('registering a Partner', () => {
    it('creates the account below the sponsor, awaiting activation, and logs it in', async () => {
      const { org, a } = await newOrg();
      const { token } = await link(await agentFor(a.email));
      const client = request.agent(app.getHttpServer());
      const input = form(token, { email: '  New.Partner@Example.com ' });

      const body = await gql(client, REGISTER, { input });

      expect(body.errors).toBeUndefined();
      expect(body.data!.register).toMatchObject({
        email: 'new.partner@example.com',
        role: 'GENERAL',
        state: 'PENDING_ACTIVATION',
        locale: 'pl',
      });
      const me = await gql(client, VIEWER);
      expect(me.data!.viewer.email).toBe('new.partner@example.com');

      const [account] = await testDb.db
        .select()
        .from(accounts)
        .where(eq(accounts.email, 'new.partner@example.com'));
      expect(account).toMatchObject({
        orgSchema: org,
        partnerCountry: 'PL',
        partnerNumber: input.partnerNumber,
        isSuperAdmin: false,
      });
      expect(account?.passwordHash).toMatch(/^scrypt\$/);

      const { partners, roleHistory } = orgTables(org);
      const [partner] = await testDb.db
        .select()
        .from(partners)
        .where(eq(partners.accountId, account!.id));
      expect(partner).toMatchObject({
        role: 'GENERAL',
        state: 'PENDING_ACTIVATION',
        status: 'INACTIVE',
        recommenderId: a.accountId,
        invitedById: a.accountId,
      });
      const history = await testDb.db
        .select()
        .from(roleHistory)
        .where(eq(roleHistory.accountId, account!.id));
      expect(history).toMatchObject([
        { role: 'GENERAL', changedBy: a.accountId },
      ]);
    });

    it('puts the account under the sponsor named in the link, not the inviter', async () => {
      const { org, root, a } = await newOrg();
      const { token } = await link(await agentFor(root.email), {
        recommenderId: a.accountId,
      });

      const body = await register(anonymous(), token);

      const [partner] = await testDb.db
        .select()
        .from(orgTables(org).partners)
        .where(eq(orgTables(org).partners.accountId, body.data!.register.id));
      expect(partner).toMatchObject({
        recommenderId: a.accountId,
        invitedById: root.accountId,
      });
    });

    it('uses up the link when the account is saved', async () => {
      const { a } = await newOrg();
      const { token } = await link(await agentFor(a.email));

      expect((await register(anonymous(), token)).errors).toBeUndefined();

      expect(errorOf(await register(anonymous(), token))?.code).toBe(
        'INVITATION_INVALID',
      );
      expect(
        (await gql(anonymous(), PREVIEW, { token })).data!.invitation,
      ).toBeNull();
    });

    it('lets only one of two simultaneous saves through', async () => {
      const { a } = await newOrg();
      const { token } = await link(await agentFor(a.email));

      const results = await Promise.all([
        register(anonymous(), token),
        register(anonymous(), token),
      ]);

      const ok = results.filter((r) => !r.errors);
      const failed = results.filter((r) => r.errors);
      expect(ok).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect(errorOf(failed[0]!)?.code).toBe('INVITATION_INVALID');
    });

    it.each([
      [
        'a password that is too short',
        { password: 'short', passwordConfirmation: 'short' },
        'password',
      ],
      [
        'a confirmation that differs',
        { passwordConfirmation: 'something else entirely' },
        'passwordConfirmation',
      ],
      ['a malformed e-mail address', { email: 'nope' }, 'email'],
      [
        'a malformed partner number',
        { partnerNumber: '12/3' },
        'partnerNumber',
      ],
      ['an invalid country', { country: 'POL' }, 'country'],
    ])(
      'rejects %s and keeps the link usable',
      async (_label, overrides, field) => {
        const { a } = await newOrg();
        const { token } = await link(await agentFor(a.email));

        const body = await register(anonymous(), token, overrides);

        expect(errorOf(body)).toMatchObject({
          code: 'VALIDATION_FAILED',
          field,
        });
        expect(
          (await gql(anonymous(), PREVIEW, { token })).data!.invitation,
        ).not.toBeNull();
      },
    );

    it('refuses an e-mail address that already has an account, and keeps the link', async () => {
      const { a } = await newOrg();
      const { token } = await link(await agentFor(a.email));

      const body = await register(anonymous(), token, {
        email: a.email.toUpperCase(),
      });

      expect(errorOf(body)?.code).toBe('EMAIL_TAKEN');
      expect((await register(anonymous(), token)).errors).toBeUndefined();
    });

    it('refuses a partner number that is already taken, in any spelling', async () => {
      const { a } = await newOrg();
      const agent = await agentFor(a.email);
      const first = await link(agent);
      const second = await link(agent);
      await register(anonymous(), first.token, {
        partnerNumber: 'ab 123 456',
        country: 'PL',
      });

      const clash = await register(anonymous(), second.token, {
        partnerNumber: 'AB123456',
        country: 'pl',
      });
      expect(errorOf(clash)?.code).toBe('PARTNER_NUMBER_TAKEN');

      // The same number issued in another country is another number.
      const other = await register(anonymous(), second.token, {
        partnerNumber: 'AB123456',
        country: 'DE',
      });
      expect(other.errors).toBeUndefined();
    });

    it('refuses an expired link', async () => {
      const { a } = await newOrg();
      const { token, id } = await link(await agentFor(a.email));
      await expire(id);

      expect(errorOf(await register(anonymous(), token))?.code).toBe(
        'INVITATION_INVALID',
      );
    });

    it('refuses a link whose inviter has been deactivated since', async () => {
      const { org, a } = await newOrg();
      const { token } = await link(await agentFor(a.email));
      await testDb.db
        .update(orgTables(org).partners)
        .set({ state: 'DEACTIVATED' })
        .where(eq(orgTables(org).partners.accountId, a.accountId));

      expect(errorOf(await register(anonymous(), token))?.code).toBe(
        'INVITATION_INVALID',
      );
    });

    it('refuses an unknown token', async () => {
      expect(errorOf(await register(anonymous(), 'no-such-token'))?.code).toBe(
        'INVITATION_INVALID',
      );
    });

    it('logs the registration without any secret', async () => {
      const { a } = await newOrg();
      const { token } = await link(await agentFor(a.email));
      const body = await register(anonymous(), token);
      const accountId = body.data!.register.id;

      const entries = await testDb.db
        .select()
        .from(auditLog)
        .where(eq(auditLog.subjectAccountId, accountId));

      expect(entries.map((e) => e.action)).toEqual(['account.register']);
      const serialized = JSON.stringify(entries);
      expect(serialized).not.toContain('scrypt');
      expect(serialized).not.toContain(token);
    });
  });

  describe('registering a Platinum', () => {
    const schemaExists = async (name: string) => {
      const rows = await testDb.db.execute(
        sql`select 1 from information_schema.schemata where schema_name = ${name}`,
      );
      return rows.length > 0;
    };
    const schemaCount = async () =>
      (await testDb.db.select().from(orgSchemas)).length;

    async function platinumLink() {
      const superAdmin = await createSuperAdmin(testDb);
      const created = await link(await agentFor(superAdmin.email), {
        kind: 'PLATINUM',
      });
      return { ...created, superAdmin };
    }

    it('founds a new organization with the Platinum as its root', async () => {
      const { token, superAdmin } = await platinumLink();
      const before = await schemaCount();
      const client = request.agent(app.getHttpServer());

      const body = await register(client, token);

      expect(body.errors).toBeUndefined();
      // Not active at once (decision 76).
      expect(body.data!.register).toMatchObject({
        role: 'PLATINUM',
        state: 'PENDING_ACTIVATION',
      });
      expect(await schemaCount()).toBe(before + 1);

      const [account] = await testDb.db
        .select()
        .from(accounts)
        .where(eq(accounts.id, body.data!.register.id));
      const org = account!.orgSchema!;
      expect(await schemaExists(org)).toBe(true);

      const [registry] = await testDb.db
        .select()
        .from(orgSchemas)
        .where(eq(orgSchemas.name, org));
      expect(registry?.rootAccountId).toBe(account!.id);

      const [partner] = await testDb.db
        .select()
        .from(orgTables(org).partners)
        .where(eq(orgTables(org).partners.accountId, account!.id));
      expect(partner).toMatchObject({
        role: 'PLATINUM',
        state: 'PENDING_ACTIVATION',
        recommenderId: null,
        invitedById: superAdmin.accountId,
      });

      const log = await testDb.db
        .select()
        .from(auditLog)
        .where(eq(auditLog.objectId, org));
      expect(log.map((e) => e.action)).toEqual(['organization.create']);
    });

    it('gives every Platinum an organization of their own', async () => {
      const first = await platinumLink();
      const second = await platinumLink();

      const a = await register(anonymous(), first.token);
      const b = await register(anonymous(), second.token);

      const orgs = await testDb.db
        .select({ org: accounts.orgSchema })
        .from(accounts)
        .where(
          sql`${accounts.id} in (${a.data!.register.id}, ${b.data!.register.id})`,
        );
      expect(new Set(orgs.map((o) => o.org)).size).toBe(2);
    });

    it('leaves no schema behind when saving the account fails', async () => {
      const { token } = await platinumLink();
      const taken = await createPartner(testDb, await createOrg(testDb));
      const before = await schemaCount();

      const body = await register(anonymous(), token, { email: taken.email });

      expect(errorOf(body)?.code).toBe('EMAIL_TAKEN');
      expect(await schemaCount()).toBe(before);
      // The link survives, so the person can correct the form.
      expect((await register(anonymous(), token)).errors).toBeUndefined();
    });

    it('creates one schema even when the same link is saved twice at once', async () => {
      const { token } = await platinumLink();
      const before = await schemaCount();

      const results = await Promise.all([
        register(anonymous(), token),
        register(anonymous(), token),
      ]);

      expect(results.filter((r) => !r.errors)).toHaveLength(1);
      expect(await schemaCount()).toBe(before + 1);
    });
  });
});
