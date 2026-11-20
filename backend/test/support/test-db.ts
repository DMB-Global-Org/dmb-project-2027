import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Database } from '../../src/db/database.tokens.js';
import * as schema from '../../src/db/schema/index.js';
import { testDatabaseUrl } from './config.js';

export interface TestDb {
  db: Database;
  client: postgres.Sql;
  close: () => Promise<void>;
}

/** Opens a connection configured like production (`prepare: false`). */
export function createTestDb(): TestDb {
  const client = postgres(testDatabaseUrl(), {
    prepare: false,
    max: 5,
    onnotice: () => {},
  });
  return {
    db: drizzle(client, { schema }),
    client,
    close: () => client.end({ timeout: 5 }),
  };
}
