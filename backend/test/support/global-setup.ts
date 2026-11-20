import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { testDatabaseUrl } from './config.js';

/**
 * Runs once before all integration tests: wipes every schema this project
 * owns (`app`, `drizzle`, `org_*`) and applies the `app` migrations from
 * scratch, so each run starts from a clean, known state.
 */
export default async function setup(): Promise<void> {
  const sql = postgres(testDatabaseUrl(), { max: 1, onnotice: () => {} });
  try {
    const schemas = await sql<{ schema_name: string }[]>`
      select schema_name
      from information_schema.schemata
      where schema_name in ('app', 'drizzle') or schema_name like 'org!_%' escape '!'
    `;
    for (const { schema_name } of schemas) {
      await sql.unsafe(`drop schema "${schema_name}" cascade`);
    }
    await migrate(drizzle(sql), { migrationsFolder: './drizzle' });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
