import { pgSchema } from 'drizzle-orm/pg-core';

// Application tables live in a dedicated Postgres schema, separate from
// Supabase-managed schemas (auth, storage, realtime, ...).
export const appSchema = pgSchema('app');
