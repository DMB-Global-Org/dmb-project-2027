import { index, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';
import { appSchema } from './app.schema.js';

// System log (rule 9): append-only. A trigger (see the audit_log_immutable
// migration) rejects UPDATE, DELETE and TRUNCATE.
export const auditLog = appSchema.table(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    // Null for system-initiated operations.
    actorAccountId: uuid('actor_account_id').references(() => accounts.id),
    action: text('action').notNull(),
    objectType: text('object_type').notNull(),
    objectId: text('object_id'),
    // The account the operation concerns; drives who may see the entry.
    subjectAccountId: uuid('subject_account_id').references(() => accounts.id),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (t) => [index('audit_log_subject_at_idx').on(t.subjectAccountId, t.at)],
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
