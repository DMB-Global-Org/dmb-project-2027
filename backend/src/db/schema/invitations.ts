import { sql } from 'drizzle-orm';
import {
  check,
  index,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { accounts, orgSchemas } from './accounts.js';
import { appSchema } from './app.schema.js';
import { invitationKindEnum } from './enums.js';

// Registration links (decisions 68, 69, 75). The link carries the sponsor and
// the organization, so the registration form asks for neither. Only a hash of
// the token is stored, like for sessions.
export const invitations = appSchema.table(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: text('token_hash').notNull(),
    kind: invitationKindEnum('kind').notNull(),
    inviterAccountId: uuid('inviter_account_id')
      .notNull()
      .references(() => accounts.id),
    // The sponsor of the new account: the inviter or somebody in their
    // downline. Null for a Platinum invitation (the new account is a root).
    recommenderAccountId: uuid('recommender_account_id').references(
      () => accounts.id,
    ),
    // Organization the new Partner joins. Null for a Platinum invitation: the
    // schema is created when the registration is saved.
    orgSchema: text('org_schema').references(() => orgSchemas.name),
    // Who the link is meant for: an e-mail address (invitation by e-mail) or
    // the phone number used in WhatsApp (link or QR code). Prefills the form.
    recipientEmail: text('recipient_email'),
    recipientPhone: text('recipient_phone'),
    locale: text('locale').notNull().default('pl'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // 72 hours after creation (decision 75).
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    // Set in the transaction that saves the account; then the link is dead.
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    consumedByAccountId: uuid('consumed_by_account_id').references(
      () => accounts.id,
    ),
  },
  (t) => [
    unique('invitations_token_hash_key').on(t.tokenHash),
    index('invitations_inviter_created_idx').on(
      t.inviterAccountId,
      t.createdAt,
    ),
    check(
      'invitations_kind_shape',
      sql`(${t.kind} = 'PARTNER' and ${t.recommenderAccountId} is not null and ${t.orgSchema} is not null)
        or (${t.kind} = 'PLATINUM' and ${t.recommenderAccountId} is null and ${t.orgSchema} is null)`,
    ),
    check(
      'invitations_has_recipient',
      sql`${t.recipientEmail} is not null or ${t.recipientPhone} is not null`,
    ),
    check(
      'invitations_recipient_email_lowercase',
      sql`${t.recipientEmail} is null or ${t.recipientEmail} = lower(${t.recipientEmail})`,
    ),
    check(
      'invitations_consumed_pair',
      sql`(${t.consumedAt} is null) = (${t.consumedByAccountId} is null)`,
    ),
  ],
);

export type InvitationRow = typeof invitations.$inferSelect;
