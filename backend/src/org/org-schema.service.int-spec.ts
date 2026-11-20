import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { expectPgError, PG } from '../../test/support/pg-error.js';
import { createTestDb, type TestDb } from '../../test/support/test-db.js';
import {
  applyOrgMigrations,
  loadOrgMigrations,
  parseOrgMigration,
  type OrgMigration,
} from '../db/org-migrator/runner.js';
import { orgTables } from '../db/org/org-tables.js';
import { ORG_SCHEMA_NAME_PATTERN } from '../db/org/schema.js';
import { accounts, orgSchemaMigrations } from '../db/schema/index.js';
import { TxRunner } from '../db/tx-runner.js';
import { OrgSchemaService } from './org-schema.service.js';

describe('OrgSchemaService and the organization migration track (integration)', () => {
  let testDb: TestDb;
  let runner: TxRunner;
  let service: OrgSchemaService;
  let realMigrations: OrgMigration[];

  const createOrg = (migrations?: OrgMigration[]) =>
    runner.run((tx) => service.create(tx, migrations));

  const tablesIn = async (schema: string) => {
    const rows = await testDb.db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = ${schema} order by table_name`,
    );
    return rows.map((row) => row.table_name);
  };

  const schemaExists = async (schema: string) => {
    const rows = await testDb.db.execute(
      sql`select 1 from information_schema.schemata where schema_name = ${schema}`,
    );
    return rows.length > 0;
  };

  const newAccount = async (orgSchema: string) => {
    const [row] = await testDb.db
      .insert(accounts)
      .values({ email: `${randomUUID()}@example.com`, orgSchema })
      .returning({ id: accounts.id });
    return row!.id;
  };

  beforeAll(async () => {
    testDb = createTestDb();
    runner = new TxRunner(testDb.db);
    service = new OrgSchemaService(testDb.db);
    realMigrations = await loadOrgMigrations();
  });

  afterAll(async () => {
    await testDb.close();
  });

  describe('create', () => {
    it('registers a new schema with the tables of the organization track', async () => {
      const name = await createOrg();

      expect(name).toMatch(ORG_SCHEMA_NAME_PATTERN);
      expect(await tablesIn(name)).toEqual(['partners', 'role_history']);
      expect(await service.list()).toContain(name);

      const recorded = await testDb.db
        .select({ file: orgSchemaMigrations.file })
        .from(orgSchemaMigrations)
        .where(eq(orgSchemaMigrations.schemaName, name));
      expect(recorded.map((r) => r.file)).toEqual(
        realMigrations.map((m) => m.file),
      );
    });

    it('gives every organization its own schema name and tables', async () => {
      const a = await createOrg();
      const b = await createOrg();
      expect(a).not.toBe(b);

      const accountId = await newAccount(a);
      await testDb.db.insert(orgTables(a).partners).values({ accountId });

      const inA = await testDb.db.select().from(orgTables(a).partners);
      const inB = await testDb.db.select().from(orgTables(b).partners);
      expect(inA).toHaveLength(1);
      expect(inB).toHaveLength(0);
    });

    it('rolls back the schema, the registry row and the records when a migration fails', async () => {
      const broken = parseOrgMigration(
        '9999_broken.sql',
        'select * from "org_template"."table_that_does_not_exist";',
      );
      const before = await service.list();

      await expect(createOrg([...realMigrations, broken])).rejects.toThrow();

      expect(await service.list()).toEqual(before);
      const existing = await testDb.db.execute<{ schema_name: string }>(
        sql`select schema_name from information_schema.schemata where schema_name like 'org!_%' escape '!'`,
      );
      const leftovers = existing
        .map((row) => row.schema_name)
        .filter((name) => !before.includes(name));
      // Schemas created by earlier tests are in `before` only when registered,
      // and every one of them is: so a rolled-back schema would show up here.
      expect(leftovers).toEqual([]);
    });
  });

  describe('orgTables', () => {
    it('binds the tables to the requested schema', async () => {
      const name = await createOrg();
      expect(getTableConfig(orgTables(name).partners).schema).toBe(name);
      expect(getTableConfig(orgTables(name).roleHistory).schema).toBe(name);
      expect(orgTables(name)).toBe(orgTables(name));
    });

    it.each(['public', 'app', 'org_template', 'org_zzzzzzzz', 'org_1234567', 'org_123456789', 'org_aaaaaaaa"; drop schema app; --'])(
      'rejects the name %j',
      (name) => {
        expect(() => orgTables(name)).toThrow('Invalid organization schema name');
      },
    );
  });

  describe('structure enforced by the database', () => {
    it('stores a partner with the default role, status and state', async () => {
      const name = await createOrg();
      const accountId = await newAccount(name);
      const [row] = await testDb.db
        .insert(orgTables(name).partners)
        .values({ accountId })
        .returning();

      expect(row?.role).toBe('GENERAL');
      expect(row?.status).toBe('INACTIVE');
      expect(row?.state).toBe('PENDING_ACTIVATION');
      expect(row?.recommenderId).toBeNull();
    });

    it('rejects a partner without an account in the directory', async () => {
      const name = await createOrg();
      const code = await expectPgError(() =>
        testDb.db
          .insert(orgTables(name).partners)
          .values({ accountId: randomUUID() }),
      );
      expect(code).toBe(PG.foreignKeyViolation);
    });

    it('accepts a sponsor from the same organization', async () => {
      const name = await createOrg();
      const { partners } = orgTables(name);
      const sponsorId = await newAccount(name);
      const memberId = await newAccount(name);
      await testDb.db.insert(partners).values({ accountId: sponsorId });
      await testDb.db
        .insert(partners)
        .values({ accountId: memberId, recommenderId: sponsorId });

      const [row] = await testDb.db
        .select({ recommenderId: partners.recommenderId })
        .from(partners)
        .where(eq(partners.accountId, memberId));
      expect(row?.recommenderId).toBe(sponsorId);
    });

    it('rejects a sponsor from another organization (rule 6)', async () => {
      const a = await createOrg();
      const b = await createOrg();
      const sponsorInA = await newAccount(a);
      const memberInB = await newAccount(b);
      await testDb.db
        .insert(orgTables(a).partners)
        .values({ accountId: sponsorInA });

      const code = await expectPgError(() =>
        testDb.db
          .insert(orgTables(b).partners)
          .values({ accountId: memberInB, recommenderId: sponsorInA }),
      );
      expect(code).toBe(PG.foreignKeyViolation);
    });
  });

  describe('runner', () => {
    it('is idempotent: a second run applies nothing', async () => {
      const name = await createOrg();
      const again = await runner.run((tx) =>
        applyOrgMigrations(tx, name, realMigrations),
      );
      expect(again).toEqual([]);
    });

    it('brings every schema up to date when a migration is added later', async () => {
      const a = await createOrg();
      const b = await createOrg();
      const addFlag = parseOrgMigration(
        '9000_add_flag.sql',
        'ALTER TABLE "org_template"."partners" ADD COLUMN "test_flag" boolean;',
      );
      const all = [...realMigrations, addFlag];

      for (const name of [a, b]) {
        const applied = await runner.run((tx) =>
          applyOrgMigrations(tx, name, all),
        );
        expect(applied).toEqual(['9000_add_flag.sql']);
      }

      for (const name of [a, b]) {
        const columns = await testDb.db.execute<{ column_name: string }>(
          sql`select column_name from information_schema.columns where table_schema = ${name} and table_name = 'partners' and column_name = 'test_flag'`,
        );
        expect(columns).toHaveLength(1);
      }
    });

    it('refuses a migration that changed after it was applied', async () => {
      const name = await createOrg();
      const [first, ...rest] = realMigrations;
      const tampered = parseOrgMigration(
        first!.file,
        `${first!.statements.join('\n--> statement-breakpoint\n')}\n-- edited`,
      );

      await expect(
        runner.run((tx) => applyOrgMigrations(tx, name, [tampered, ...rest])),
      ).rejects.toThrow('was changed after it was applied');
    });

    it.each(['public', 'app', 'org_template', 'org_ZZZZZZZZ', 'x"; drop schema app cascade; --'])(
      'never touches a schema called %j',
      async (name) => {
        await expect(
          runner.run((tx) => applyOrgMigrations(tx, name, realMigrations)),
        ).rejects.toThrow('Invalid organization schema name');
        expect(await schemaExists('app')).toBe(true);
      },
    );
  });

  describe('assertRegistered', () => {
    it('accepts a registered schema', async () => {
      const name = await createOrg();
      await expect(service.assertRegistered(name)).resolves.toBeUndefined();
    });

    it('rejects a well-formed name that is not registered', async () => {
      await expect(service.assertRegistered('org_deadbeef')).rejects.toThrow(
        'Unknown organization schema',
      );
    });

    it('rejects a malformed name before touching the database', async () => {
      await expect(service.assertRegistered('public')).rejects.toThrow(
        'Invalid organization schema name',
      );
    });
  });
});
