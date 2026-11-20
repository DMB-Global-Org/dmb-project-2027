import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  index,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { accounts } from '../schema/accounts.js';
import {
  accountStateEnum,
  partnerStatusEnum,
  roleEnum,
} from '../schema/enums.js';

/** Format of the server-generated name of an organization schema. */
export const ORG_SCHEMA_NAME_PATTERN = /^org_[0-9a-f]{8}$/;

/**
 * Name of the template schema that `drizzle-kit` generates the organization
 * migrations for. It never exists in the database: our runner replaces it
 * with the real schema name (see src/db/org-migrator).
 */
export const ORG_TEMPLATE_SCHEMA = 'org_template';

/**
 * Tables that exist once per Platinum organization. One definition, bound to
 * a schema name, so queries are always qualified with the right schema.
 * Use `orgTables(name)` (org-tables.ts) at runtime, not this function.
 */
export function defineOrgTables(schemaName: string) {
  const orgSchema = pgSchema(schemaName);

  const partners = orgSchema.table(
    'partners',
    {
      accountId: uuid('account_id')
        .primaryKey()
        .references(() => accounts.id),
      firstName: text('first_name'),
      lastName: text('last_name'),
      // Phone number used in WhatsApp.
      phone: text('phone'),
      role: roleEnum('role').notNull().default('GENERAL'),
      status: partnerStatusEnum('status').notNull().default('INACTIVE'),
      state: accountStateEnum('state').notNull().default('PENDING_ACTIVATION'),
      profileCompletedAt: timestamp('profile_completed_at', {
        withTimezone: true,
      }),
      // When the owner accepted the terms and consents (decision 85). The texts
      // and their versions arrive with the consent module.
      consentsAcceptedAt: timestamp('consents_accepted_at', {
        withTimezone: true,
      }),
      // The sponsor (rekomendujący). The foreign key points into the same
      // schema, so a sponsor from another organization is impossible by
      // construction (rule 6). Null only at the root of the organization.
      recommenderId: uuid('recommender_id').references(
        (): AnyPgColumn => partners.accountId,
      ),
      // Who invited the person; never changes, unlike the sponsor.
      invitedById: uuid('invited_by_id').references(() => accounts.id),
      // Removal from the structure (decision 72): the row stays, but the account
      // leaves the tree and the lists. `removedRecommenderId` is the sponsor at
      // the moment of removal; `recommenderId` is cleared.
      removedAt: timestamp('removed_at', { withTimezone: true }),
      removedBy: uuid('removed_by').references(() => accounts.id),
      removedRecommenderId: uuid('removed_recommender_id').references(
        () => accounts.id,
      ),
      createdAt: timestamp('created_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
    },
    (t) => [index('partners_recommender_id_idx').on(t.recommenderId)],
  );

  const roleHistory = orgSchema.table(
    'role_history',
    {
      id: uuid('id')
        .primaryKey()
        .default(sql`gen_random_uuid()`),
      accountId: uuid('account_id')
        .notNull()
        .references(() => partners.accountId),
      role: roleEnum('role').notNull(),
      changedBy: uuid('changed_by').references(() => accounts.id),
      changedAt: timestamp('changed_at', { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [index('role_history_account_id_idx').on(t.accountId)],
  );

  return { schemaName, partners, roleHistory };
}

export type OrgTables = ReturnType<typeof defineOrgTables>;
