// Applies the organization migration track to every registered organization
// schema: `pnpm --filter backend db:migrate:orgs`. Run it after `db:migrate`
// (the registry and the tracking table live in the `app` schema).
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema/index.js';
import { applyOrgMigrations, loadOrgMigrations } from './runner.js';

// Locally read backend/.env; in CI/CD the variable comes from the environment.
try {
  process.loadEnvFile();
} catch {
  // no .env file
}

const url = process.env.DATABASE_DIRECT_URL;
if (!url) throw new Error('DATABASE_DIRECT_URL is not set');

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const db = drizzle(client, { schema });

try {
  const migrations = await loadOrgMigrations();
  const rows = await db
    .select({ name: schema.orgSchemas.name })
    .from(schema.orgSchemas)
    .orderBy(schema.orgSchemas.name);

  for (const { name } of rows) {
    // One transaction per schema; stop at the first failure.
    const applied = await db.transaction((tx) =>
      applyOrgMigrations(tx, name, migrations),
    );
    console.log(
      applied.length
        ? `${name}: applied ${applied.join(', ')}`
        : `${name}: up to date`,
    );
  }
  console.log(`Organization schemas checked: ${rows.length}`);
} finally {
  await client.end({ timeout: 5 });
}
