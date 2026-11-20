import { index, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';
import { appSchema } from './app.schema.js';

// Server-side sessions: revoking a row cuts the account off immediately
// (deactivation relies on it). Only a hash of the token is stored, so a leaked
// table cannot be replayed as cookies.
export const sessions = appSchema.table(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: text('token_hash').notNull(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (t) => [
    unique('sessions_token_hash_key').on(t.tokenHash),
    index('sessions_account_id_idx').on(t.accountId),
  ],
);

export type SessionRow = typeof sessions.$inferSelect;
