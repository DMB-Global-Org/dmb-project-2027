import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../db/database.tokens.js';
import {
  applyOrgMigrations,
  loadOrgMigrations,
  type OrgMigration,
} from '../db/org-migrator/runner.js';
import { assertOrgSchemaName } from '../db/org/org-tables.js';
import { orgSchemas } from '../db/schema/index.js';
import type { Tx } from '../db/tx-runner.js';

@Injectable()
export class OrgSchemaService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Registers and creates a new organization schema with every migration of
   * the organization track. Pass the transaction of the caller (e.g. Platinum
   * registration or promotion), so the schema and the rest of the operation
   * commit or roll back together. `migrations` is for tests.
   */
  async create(tx: Tx, migrations?: OrgMigration[]): Promise<string> {
    const name = `org_${randomBytes(4).toString('hex')}`;
    await tx.insert(orgSchemas).values({ name });
    await applyOrgMigrations(
      tx,
      name,
      migrations ?? (await loadOrgMigrations()),
    );
    return name;
  }

  async list(): Promise<string[]> {
    const rows = await this.db
      .select({ name: orgSchemas.name })
      .from(orgSchemas)
      .orderBy(orgSchemas.name);
    return rows.map((row) => row.name);
  }

  /** Throws unless `name` is a well-formed, registered organization schema. */
  async assertRegistered(name: string, executor: Database | Tx = this.db) {
    assertOrgSchemaName(name);
    const [row] = await executor
      .select({ name: orgSchemas.name })
      .from(orgSchemas)
      .where(eq(orgSchemas.name, name));
    if (!row) throw new Error(`Unknown organization schema: ${name}`);
  }
}
