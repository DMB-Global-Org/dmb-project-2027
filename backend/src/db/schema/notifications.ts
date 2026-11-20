import {
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { appSchema } from './app.schema.js';
import { mailings } from './mailings.js';
import { notificationStatusEnum } from './enums.js';

// Outbox of e-mails. A row is written in the same transaction as the business
// operation that causes the message, so the message exists exactly when the
// operation committed. A dispatcher sends rows later and retries failures.
export const notifications = appSchema.table(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Template name, e.g. `invitation`.
    type: text('type').notNull(),
    recipientEmail: text('recipient_email').notNull(),
    locale: text('locale').notNull().default('pl'),
    // Data for the template. May hold a secret (a registration link), so it is
    // cleared as soon as the row reaches a final state (SENT or FAILED).
    payload: jsonb('payload'),
    status: notificationStatusEnum('status').notNull().default('PENDING'),
    attempts: integer('attempts').notNull().default(0),
    // When the dispatcher may pick the row up (also used as a lease while a
    // send is in flight).
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    // The organizational mailing this message belongs to, if any.
    mailingId: uuid('mailing_id').references(() => mailings.id),
  },
  (t) => [
    index('notifications_due_idx').on(t.status, t.nextAttemptAt),
    index('notifications_mailing_idx').on(t.mailingId),
  ],
);

export type NotificationRow = typeof notifications.$inferSelect;
