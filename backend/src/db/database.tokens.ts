import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema/index.js';

export const DB = Symbol('DB');
export const PG_CLIENT = Symbol('PG_CLIENT');

export type Database = PostgresJsDatabase<typeof schema>;
