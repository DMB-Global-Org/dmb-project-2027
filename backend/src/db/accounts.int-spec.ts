import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { expectPgError, PG } from '../../test/support/pg-error.js';
import { createTestDb, type TestDb } from '../../test/support/test-db.js';
import { accounts, orgSchemas } from './schema/index.js';

describe('accounts constraints (integration)', () => {
  let testDb: TestDb;
  const orgName = 'org_acc00001';

  const email = () => `${randomUUID()}@example.com`;
  const partner = (over: Partial<typeof accounts.$inferInsert> = {}) => ({
    email: email(),
    orgSchema: orgName,
    ...over,
  });

  beforeAll(async () => {
    testDb = createTestDb();
    await testDb.db.insert(orgSchemas).values({ name: orgName });
  });

  afterAll(async () => {
    await testDb.close();
  });

  it('stores a partner account with a number and country', async () => {
    const [row] = await testDb.db
      .insert(accounts)
      .values(partner({ partnerNumber: '1001', partnerCountry: 'PL' }))
      .returning();
    expect(row?.locale).toBe('pl');
    expect(row?.isSuperAdmin).toBe(false);
  });

  it('requires a unique e-mail', async () => {
    const duplicated = email();
    await testDb.db.insert(accounts).values(partner({ email: duplicated }));
    const code = await expectPgError(() =>
      testDb.db.insert(accounts).values(partner({ email: duplicated })),
    );
    expect(code).toBe(PG.uniqueViolation);
  });

  it('requires a lowercase e-mail', async () => {
    const code = await expectPgError(() =>
      testDb.db.insert(accounts).values(partner({ email: 'Mixed@Example.com' })),
    );
    expect(code).toBe(PG.checkViolation);
  });

  it('makes the Partner number unique per country across the whole app', async () => {
    await testDb.db
      .insert(accounts)
      .values(partner({ partnerNumber: '2002', partnerCountry: 'PL' }));

    const code = await expectPgError(() =>
      testDb.db
        .insert(accounts)
        .values(partner({ partnerNumber: '2002', partnerCountry: 'PL' })),
    );
    expect(code).toBe(PG.uniqueViolation);

    // The same number in another country is a different Partner.
    await testDb.db
      .insert(accounts)
      .values(partner({ partnerNumber: '2002', partnerCountry: 'DE' }));
  });

  it('requires number and country together', async () => {
    const code = await expectPgError(() =>
      testDb.db.insert(accounts).values(partner({ partnerNumber: '3003' })),
    );
    expect(code).toBe(PG.checkViolation);
  });

  it('ties the organization schema to non-super-admin accounts only', async () => {
    const withoutOrg = await expectPgError(() =>
      testDb.db.insert(accounts).values({ email: email() }),
    );
    expect(withoutOrg).toBe(PG.checkViolation);

    const superWithOrg = await expectPgError(() =>
      testDb.db.insert(accounts).values(partner({ isSuperAdmin: true })),
    );
    expect(superWithOrg).toBe(PG.checkViolation);

    await testDb.db
      .insert(accounts)
      .values({ email: email(), isSuperAdmin: true });
  });

  it('rejects an organization schema that is not registered', async () => {
    const code = await expectPgError(() =>
      testDb.db
        .insert(accounts)
        .values(partner({ orgSchema: 'org_ffffffff' })),
    );
    expect(code).toBe(PG.foreignKeyViolation);
  });

  it('accepts only the generated schema name format in the registry', async () => {
    const code = await expectPgError(() =>
      testDb.db.execute(sql`insert into app.org_schemas (name) values ('public')`),
    );
    expect(code).toBe(PG.checkViolation);
  });
});
