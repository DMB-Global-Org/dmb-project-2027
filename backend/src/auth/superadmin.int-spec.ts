import { eq } from 'drizzle-orm';
import {
  createOrg,
  createPartner,
  uniqueEmail,
} from '../../test/support/fixtures.js';
import { createTestDb, type TestDb } from '../../test/support/test-db.js';
import { accounts } from '../db/schema/index.js';
import { verifyPassword } from './password.js';
import { ensureSuperAdmin } from './superadmin.js';

describe('ensureSuperAdmin (integration)', () => {
  let testDb: TestDb;
  const find = async (email: string) => {
    const [row] = await testDb.db
      .select()
      .from(accounts)
      .where(eq(accounts.email, email));
    return row;
  };

  beforeAll(() => {
    testDb = createTestDb();
  });

  afterAll(async () => {
    await testDb.close();
  });

  it('creates a SuperAdministrator without an organization', async () => {
    const email = uniqueEmail();

    expect(
      await ensureSuperAdmin(testDb.db, {
        email,
        password: 'a long enough password',
      }),
    ).toBe('created');

    const row = await find(email);
    expect(row?.isSuperAdmin).toBe(true);
    expect(row?.orgSchema).toBeNull();
    expect(
      await verifyPassword('a long enough password', row!.passwordHash!),
    ).toBe(true);
  });

  it('is idempotent and does not touch an existing password', async () => {
    const email = uniqueEmail();
    await ensureSuperAdmin(testDb.db, {
      email,
      password: 'the first password',
    });

    expect(
      await ensureSuperAdmin(testDb.db, {
        email,
        password: 'a different password',
      }),
    ).toBe('exists');

    const row = await find(email);
    expect(await verifyPassword('the first password', row!.passwordHash!)).toBe(
      true,
    );
  });

  it('sets a new password only when asked to', async () => {
    const email = uniqueEmail();
    await ensureSuperAdmin(testDb.db, {
      email,
      password: 'the first password',
    });

    expect(
      await ensureSuperAdmin(testDb.db, {
        email,
        password: 'the second password',
        resetPassword: true,
      }),
    ).toBe('password_reset');

    const row = await find(email);
    expect(
      await verifyPassword('the second password', row!.passwordHash!),
    ).toBe(true);
  });

  it('normalizes the e-mail address', async () => {
    const email = uniqueEmail();
    await ensureSuperAdmin(testDb.db, {
      email: `  ${email.toUpperCase()} `,
      password: 'a long enough password',
    });

    expect(await find(email)).toBeDefined();
  });

  it('refuses a weak password', async () => {
    await expect(
      ensureSuperAdmin(testDb.db, { email: uniqueEmail(), password: 'short' }),
    ).rejects.toThrow('too_short');
  });

  it('refuses an e-mail that already belongs to a Partner', async () => {
    const partner = await createPartner(testDb, await createOrg(testDb));

    await expect(
      ensureSuperAdmin(testDb.db, {
        email: partner.email,
        password: 'a long enough password',
      }),
    ).rejects.toThrow('already belongs to a Partner');
  });
});
