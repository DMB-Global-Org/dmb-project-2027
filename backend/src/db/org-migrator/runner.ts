import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { assertOrgSchemaName } from '../org/org-tables.js';
import { ORG_TEMPLATE_SCHEMA } from '../org/schema.js';
import { orgSchemaMigrations } from '../schema/index.js';
import type { Tx } from '../tx-runner.js';

/** Where `drizzle-kit generate --config=drizzle.org.config.ts` writes files. */
export const ORG_MIGRATIONS_DIR = fileURLToPath(
  new URL('../../../drizzle-org', import.meta.url),
);

const STATEMENT_BREAKPOINT = '--> statement-breakpoint';

export interface OrgMigration {
  file: string;
  hash: string;
  statements: string[];
}

export function parseOrgMigration(file: string, content: string): OrgMigration {
  return {
    file,
    hash: createHash('sha256').update(content).digest('hex'),
    statements: content
      .split(STATEMENT_BREAKPOINT)
      .map((statement) => statement.trim())
      .filter(Boolean),
  };
}

/**
 * Reads the migration files of the organization track, sorted by name. Plain
 * `.sql` files only: it deliberately ignores drizzle-kit's `meta/_journal.json`.
 */
export async function loadOrgMigrations(
  dir: string = ORG_MIGRATIONS_DIR,
): Promise<OrgMigration[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  return Promise.all(
    files.map(async (file) =>
      parseOrgMigration(file, await readFile(join(dir, file), 'utf8')),
    ),
  );
}

/** The template name becomes the real schema; schema creation is done by us. */
function renderStatement(statement: string, schemaName: string): string | null {
  if (/^create\s+schema\b/i.test(statement)) return null;
  return statement.replaceAll(`"${ORG_TEMPLATE_SCHEMA}"`, `"${schemaName}"`);
}

/**
 * Brings one organization schema up to date: creates it if missing and applies
 * every migration it has not seen yet, recording each in
 * `app.org_schema_migrations`. Must run inside a transaction, so a failure
 * leaves no half-migrated schema. The schema must be registered in
 * `app.org_schemas` beforehand. Returns the files applied by this call.
 */
export async function applyOrgMigrations(
  tx: Tx,
  schemaName: string,
  migrations: OrgMigration[],
): Promise<string[]> {
  // The name ends up in raw SQL below: only our generated format is allowed.
  assertOrgSchemaName(schemaName);

  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`org-migrate:${schemaName}`}, 0))`,
  );
  await tx.execute(sql.raw(`create schema if not exists "${schemaName}"`));

  const applied = await tx
    .select()
    .from(orgSchemaMigrations)
    .where(eq(orgSchemaMigrations.schemaName, schemaName));
  const appliedHashes = new Map(applied.map((row) => [row.file, row.hash]));

  const appliedNow: string[] = [];
  for (const migration of migrations) {
    const previousHash = appliedHashes.get(migration.file);
    if (previousHash !== undefined) {
      if (previousHash !== migration.hash) {
        throw new Error(
          `Migration ${migration.file} was changed after it was applied to ${schemaName}`,
        );
      }
      continue;
    }
    for (const statement of migration.statements) {
      const rendered = renderStatement(statement, schemaName);
      if (rendered) await tx.execute(sql.raw(rendered));
    }
    await tx
      .insert(orgSchemaMigrations)
      .values({ schemaName, file: migration.file, hash: migration.hash });
    appliedNow.push(migration.file);
  }
  return appliedNow;
}
