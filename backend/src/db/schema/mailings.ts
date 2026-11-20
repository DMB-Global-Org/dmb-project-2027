import {
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts.js';
import { appSchema } from './app.schema.js';
import { roleEnum } from './enums.js';

/** Subject and text of one language version of a mailing. */
export interface MailingContent {
  subject: string;
  body: string;
}

// Organizational mailings (decisions 67 and 88): one row per send, kept for the
// history. The messages themselves go through the outbox, one row per
// recipient, linked back by `notifications.mailing_id`.
export const mailings = appSchema.table(
  'mailings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    senderAccountId: uuid('sender_account_id')
      .notNull()
      .references(() => accounts.id),
    // Lowest role that received it (roles are linear).
    minRole: roleEnum('min_role').notNull(),
    // Polish version: required.
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    // Optional versions in other languages: `{ de?: MailingContent, en?: ... }`.
    translations: jsonb('translations').$type<Record<string, MailingContent>>(),
    recipientCount: integer('recipient_count').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('mailings_sender_created_idx').on(t.senderAccountId, t.createdAt),
  ],
);

export type MailingRow = typeof mailings.$inferSelect;
