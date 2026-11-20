import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import {
  createOrg,
  createPartner,
  createSuperAdmin,
  TEST_PASSWORD,
  uniqueEmail,
} from '../../test/support/fixtures.js';
import { testDatabaseUrl } from '../../test/support/config.js';
import { createTestDb, type TestDb } from '../../test/support/test-db.js';
import { orgTables } from '../db/org/org-tables.js';
import { sessions } from '../db/schema/index.js';
import { hashSessionToken } from './session.service.js';

// The whole application (guard, resolvers, cookies) against a real database.
describe('authentication over GraphQL (integration)', () => {
  let app: INestApplication;
  let testDb: TestDb;
  let org: string;

  const LOGIN = `mutation ($email: String!, $password: String!) {
    login(email: $email, password: $password) { id email role state locale }
  }`;
  const VIEWER = '{ viewer { id email role state locale } }';
  const LOGOUT = 'mutation { logout }';

  type Agent = ReturnType<typeof request.agent>;
  const gql = (
    agent: Agent | ReturnType<typeof request>,
    query: string,
    variables?: object,
  ) => agent.post('/graphql').send({ query, variables });
  const newAgent = () => request.agent(app.getHttpServer());
  const errorCode = (body: { errors?: { extensions?: { code?: string } }[] }) =>
    body.errors?.[0]?.extensions?.code;
  const cookieHeader = (res: request.Response) =>
    ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? []).join(
      '; ',
    );

  const login = (agent: Agent, email: string, password = TEST_PASSWORD) =>
    gql(agent, LOGIN, { email, password });

  beforeAll(async () => {
    testDb = createTestDb();
    org = await createOrg(testDb);

    process.env.DATABASE_URL = testDatabaseUrl();
    // Imported late: the module validates the environment when it is loaded.
    const { AppModule } = await import('../app.module.js');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await testDb.close();
  });

  describe('without logging in', () => {
    it('serves public operations', async () => {
      const res = await gql(request(app.getHttpServer()), '{ health }');
      expect(res.body.data.health).toBe('ok');
    });

    it('answers viewer with null', async () => {
      const res = await gql(request(app.getHttpServer()), VIEWER);
      expect(res.body.data.viewer).toBeNull();
      expect(res.body.errors).toBeUndefined();
    });

    it('refuses an operation that is not marked public', async () => {
      const res = await gql(request(app.getHttpServer()), LOGOUT);
      expect(errorCode(res.body)).toBe('UNAUTHENTICATED');
    });

    it('keeps plain HTTP routes (the Render health check) open', async () => {
      await request(app.getHttpServer()).get('/').expect(200);
    });
  });

  describe('login', () => {
    it('logs in, sets a protected cookie and says who you are', async () => {
      const partner = await createPartner(testDb, org, { role: 'SILVER' });
      const agent = newAgent();

      const res = await login(agent, partner.email);

      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.login).toEqual({
        id: partner.accountId,
        email: partner.email,
        role: 'SILVER',
        state: 'ACTIVE',
        locale: 'pl',
      });
      const cookie = cookieHeader(res);
      expect(cookie).toMatch(/^sid=/);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');

      const viewer = await gql(agent, VIEWER);
      expect(viewer.body.data.viewer.email).toBe(partner.email);
    });

    it('never returns the password or its hash', async () => {
      const partner = await createPartner(testDb, org);
      const res = await login(newAgent(), partner.email);

      expect(JSON.stringify(res.body)).not.toMatch(
        /scrypt|passwordHash|password_hash/i,
      );
    });

    it('does not care about the case or spaces of the e-mail', async () => {
      const partner = await createPartner(testDb, org);
      const res = await login(newAgent(), `  ${partner.email.toUpperCase()} `);

      expect(res.body.data.login.email).toBe(partner.email);
    });

    it('stores only a hash of the session token', async () => {
      const partner = await createPartner(testDb, org);
      const res = await login(newAgent(), partner.email);
      const token = /^sid=([^;]+)/.exec(cookieHeader(res))![1]!;

      const rows = await testDb.db
        .select()
        .from(sessions)
        .where(eq(sessions.accountId, partner.accountId));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.tokenHash).toBe(
        hashSessionToken(decodeURIComponent(token)),
      );
      expect(rows[0]!.tokenHash).not.toBe(token);
    });

    it('answers a wrong password and an unknown e-mail identically', async () => {
      const partner = await createPartner(testDb, org);

      const wrongPassword = await login(
        newAgent(),
        partner.email,
        'definitely not it',
      );
      const unknownEmail = await login(newAgent(), uniqueEmail());

      expect(errorCode(wrongPassword.body)).toBe('INVALID_CREDENTIALS');
      expect(wrongPassword.body.errors).toEqual(unknownEmail.body.errors);
      expect(cookieHeader(wrongPassword)).toBe('');
      expect(cookieHeader(unknownEmail)).toBe('');
    });

    it('refuses an account that has no password yet', async () => {
      const partner = await createPartner(testDb, org);
      await testDb.db.execute(
        // `accounts.password_hash` is nullable until the owner sets a password.
        (await import('drizzle-orm'))
          .sql`update app.accounts set password_hash = null where id = ${partner.accountId}`,
      );

      const res = await login(newAgent(), partner.email);
      expect(errorCode(res.body)).toBe('INVALID_CREDENTIALS');
    });

    it('rejects empty input before touching the database', async () => {
      const res = await login(newAgent(), uniqueEmail(), '');
      expect(errorCode(res.body)).toBe('VALIDATION_FAILED');
    });

    it('lets an account awaiting activation log in, to complete its profile', async () => {
      const partner = await createPartner(testDb, org, {
        state: 'PENDING_ACTIVATION',
      });
      const agent = newAgent();

      const res = await login(agent, partner.email);

      expect(res.body.data.login.state).toBe('PENDING_ACTIVATION');
      expect(res.body.data.login.role).toBe('GENERAL');
    });

    it('refuses a deactivated account, but only after the right password', async () => {
      const partner = await createPartner(testDb, org, {
        state: 'DEACTIVATED',
      });

      const right = await login(newAgent(), partner.email);
      expect(errorCode(right.body)).toBe('ACCOUNT_DEACTIVATED');
      expect(cookieHeader(right)).toBe('');

      const wrong = await login(newAgent(), partner.email, 'definitely not it');
      expect(errorCode(wrong.body)).toBe('INVALID_CREDENTIALS');
    });

    it('logs in a SuperAdministrator, who has no organization', async () => {
      const admin = await createSuperAdmin(testDb);

      const res = await login(newAgent(), admin.email);

      expect(res.body.data.login).toMatchObject({
        role: 'SUPER_ADMINISTRATOR',
        state: 'ACTIVE',
      });
    });
  });

  describe('brute-force protection', () => {
    it('blocks an e-mail after repeated failures, even for the right password', async () => {
      const partner = await createPartner(testDb, org);

      for (let i = 0; i < 5; i++) {
        const res = await login(
          newAgent(),
          partner.email,
          `wrong password ${i}`,
        );
        expect(errorCode(res.body)).toBe('INVALID_CREDENTIALS');
      }

      const blocked = await login(newAgent(), partner.email);
      expect(errorCode(blocked.body)).toBe('TOO_MANY_ATTEMPTS');
      expect(cookieHeader(blocked)).toBe('');
    });

    it('forgets earlier failures after a successful login', async () => {
      const partner = await createPartner(testDb, org);
      for (let i = 0; i < 4; i++) {
        await login(newAgent(), partner.email, `wrong password ${i}`);
      }

      expect(
        (await login(newAgent(), partner.email)).body.errors,
      ).toBeUndefined();
      for (let i = 0; i < 4; i++) {
        const res = await login(newAgent(), partner.email, `wrong again ${i}`);
        expect(errorCode(res.body)).toBe('INVALID_CREDENTIALS');
      }
    });
  });

  describe('ending a session', () => {
    it('logout revokes the session and clears the cookie', async () => {
      const partner = await createPartner(testDb, org);
      const agent = newAgent();
      await login(agent, partner.email);

      const out = await gql(agent, LOGOUT);

      expect(out.body.data.logout).toBe(true);
      expect(cookieHeader(out)).toMatch(/^sid=;/);
      expect((await gql(agent, VIEWER)).body.data.viewer).toBeNull();

      const [row] = await testDb.db
        .select()
        .from(sessions)
        .where(eq(sessions.accountId, partner.accountId));
      expect(row?.revokedAt).not.toBeNull();
    });

    it('an old cookie stays dead after logout, even if replayed', async () => {
      const partner = await createPartner(testDb, org);
      const first = await login(newAgent(), partner.email);
      const cookie = cookieHeader(first).split(';')[0]!;

      await request(app.getHttpServer())
        .post('/graphql')
        .set('Cookie', cookie)
        .send({ query: LOGOUT });

      const replay = await request(app.getHttpServer())
        .post('/graphql')
        .set('Cookie', cookie)
        .send({ query: VIEWER });
      expect(replay.body.data.viewer).toBeNull();
    });

    it('cuts off a logged-in account the moment it is deactivated', async () => {
      const partner = await createPartner(testDb, org);
      const agent = newAgent();
      await login(agent, partner.email);
      expect((await gql(agent, VIEWER)).body.data.viewer).not.toBeNull();

      await testDb.db
        .update(orgTables(org).partners)
        .set({ state: 'DEACTIVATED' })
        .where(eq(orgTables(org).partners.accountId, partner.accountId));

      expect((await gql(agent, VIEWER)).body.data.viewer).toBeNull();
      expect(errorCode((await gql(agent, LOGOUT)).body)).toBe(
        'UNAUTHENTICATED',
      );
    });

    it('stops honouring a session that expired', async () => {
      const partner = await createPartner(testDb, org);
      const agent = newAgent();
      await login(agent, partner.email);

      await testDb.db
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(sessions.accountId, partner.accountId));

      expect((await gql(agent, VIEWER)).body.data.viewer).toBeNull();
    });

    it('shows a role change on the very next request', async () => {
      const partner = await createPartner(testDb, org, { role: 'GENERAL' });
      const agent = newAgent();
      await login(agent, partner.email);

      await testDb.db
        .update(orgTables(org).partners)
        .set({ role: 'BUILDER' })
        .where(eq(orgTables(org).partners.accountId, partner.accountId));

      expect((await gql(agent, VIEWER)).body.data.viewer.role).toBe('BUILDER');
    });

    it('ignores a cookie with a made-up token', async () => {
      const res = await request(app.getHttpServer())
        .post('/graphql')
        .set('Cookie', 'sid=forged-token-value')
        .send({ query: VIEWER });

      expect(res.body.data.viewer).toBeNull();
    });
  });
});
