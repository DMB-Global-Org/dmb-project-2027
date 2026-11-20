import { randomUUID } from 'node:crypto';
import { hashPassword } from '../../src/auth/password.js';
import { orgTables } from '../../src/db/org/org-tables.js';
import {
  accounts,
  type AccountState,
  type Role,
} from '../../src/db/schema/index.js';
import { TxRunner } from '../../src/db/tx-runner.js';
import { OrgSchemaService } from '../../src/org/org-schema.service.js';
import type { TestDb } from './test-db.js';

export const TEST_PASSWORD = 'correct horse battery';

/** Cheap scrypt parameters: tests do not need production-grade hashing. */
const CHEAP_SCRYPT = { N: 1024, r: 8, p: 1 };

export const uniqueEmail = () => `${randomUUID()}@example.com`;

/** A fresh organization schema, created the way production creates it. */
export function createOrg({ db }: TestDb): Promise<string> {
  return new TxRunner(db).run((tx) => new OrgSchemaService(db).create(tx));
}

export interface PartnerFixture {
  accountId: string;
  email: string;
  password: string;
}

/** An account with a password and its Partner row in `orgSchema`. */
export async function createPartner(
  { db }: TestDb,
  orgSchema: string,
  options: {
    email?: string;
    password?: string;
    role?: Role;
    state?: AccountState;
    recommenderId?: string;
  } = {},
): Promise<PartnerFixture> {
  const email = options.email ?? uniqueEmail();
  const password = options.password ?? TEST_PASSWORD;
  const [account] = await db
    .insert(accounts)
    .values({
      email,
      orgSchema,
      passwordHash: await hashPassword(password, CHEAP_SCRYPT),
    })
    .returning({ id: accounts.id });

  await db.insert(orgTables(orgSchema).partners).values({
    accountId: account!.id,
    role: options.role ?? 'GENERAL',
    state: options.state ?? 'ACTIVE',
    recommenderId: options.recommenderId,
  });
  return { accountId: account!.id, email, password };
}

/** A SuperAdministrator account (no Partner row, no organization). */
export async function createSuperAdmin({
  db,
}: TestDb): Promise<PartnerFixture> {
  const email = uniqueEmail();
  const [account] = await db
    .insert(accounts)
    .values({
      email,
      isSuperAdmin: true,
      passwordHash: await hashPassword(TEST_PASSWORD, CHEAP_SCRYPT),
    })
    .returning({ id: accounts.id });
  return { accountId: account!.id, email, password: TEST_PASSWORD };
}
