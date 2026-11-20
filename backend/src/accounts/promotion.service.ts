import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, gt, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext, RequestMeta } from '../auth/auth.types.js';
import type { Env } from '../config/env.js';
import { orgTables } from '../db/org/org-tables.js';
import { accounts, invitations, orgSchemas } from '../db/schema/index.js';
import type { Tx } from '../db/tx-runner.js';
import { OutboxService } from '../mail/outbox.service.js';
import { OrgSchemaService } from '../org/org-schema.service.js';
import {
  RelationLoader,
  type LoadedTarget,
} from '../structure/relation-loader.js';

export interface PromotionResult {
  newSchema: string;
  /** The promoted person and everybody below them, now in the new schema. */
  movedAccountIds: string[];
}

/** `a, b, c` for an `IN (...)` list of values. */
const list = (values: string[]) =>
  sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  );

/**
 * Promotion to Platinum (decisions 64 and 77): the person and their whole
 * downline move into a new organization schema. The caller passes the
 * transaction and has already decided with `can` that the promotion is allowed;
 * schema creation, copying, deleting and the registry all commit together or
 * not at all (DDL is transactional in PostgreSQL).
 */
@Injectable()
export class PromotionService {
  constructor(
    private readonly orgs: OrgSchemaService,
    private readonly relations: RelationLoader,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Call with the structure lock of the source organization already taken and
   * the person's row locked (`AccountsService.promote` does both).
   */
  async promote(
    tx: Tx,
    input: {
      auth: AuthContext;
      target: LoadedTarget;
      meta: RequestMeta;
      now: Date;
    },
  ): Promise<PromotionResult> {
    const { auth, target, meta, now } = input;
    const source = target.orgSchema;
    const targetId = target.partner.accountId;
    const src = orgTables(source);

    // 1. Who moves: the person and everybody below them. Lock their rows, so a
    // concurrent change of one of them waits for the result.
    const members = (await this.relations.downline(source, targetId, tx)).map(
      (entry) => entry.accountId,
    );
    await tx
      .select({ id: src.partners.accountId })
      .from(src.partners)
      .where(inArray(src.partners.accountId, members))
      .for('update');
    const below = members.filter((id) => id !== targetId);
    // Somebody below may already head an organization detached earlier: their
    // marker moves with the branch, but their own organization stays what it
    // is (only its place in the registry changes, see step 5).
    const ownedHere = new Set(
      (
        await tx
          .select({ id: accounts.id })
          .from(accounts)
          .where(
            and(inArray(accounts.id, members), eq(accounts.orgSchema, source)),
          )
      ).map((row) => row.id),
    );
    const realMembers = members.filter((id) => ownedHere.has(id));
    const markers = members.filter((id) => !ownedHere.has(id));

    // 2. The new schema, registered and migrated, inside this transaction.
    const newSchema = await this.orgs.create(tx);
    const dst = orgTables(newSchema);

    // 3. Copy the rows, identifiers unchanged. The root of the new organization
    // has no sponsor inside it and the Platinum role.
    const partnerColumns = Object.values(
      getTableConfig(src.partners).columns,
    ).map((column) => column.name);
    const value = (name: string) => {
      if (name === 'recommender_id') {
        return sql`case when account_id = ${targetId} then null else recommender_id end`;
      }
      if (name === 'role') {
        return sql`case when account_id = ${targetId} then 'PLATINUM'::"app"."role" else role end`;
      }
      return sql.identifier(name);
    };
    await tx.execute(sql`
      insert into ${sql.identifier(newSchema)}.${sql.identifier('partners')}
        (${sql.join(
          partnerColumns.map((name) => sql.identifier(name)),
          sql`, `,
        )})
      select ${sql.join(partnerColumns.map(value), sql`, `)}
        from ${sql.identifier(source)}.${sql.identifier('partners')}
       where account_id in (${list(members)})
    `);
    const historyColumns = Object.values(
      getTableConfig(src.roleHistory).columns,
    ).map((column) => sql.identifier(column.name));
    await tx.execute(sql`
      insert into ${sql.identifier(newSchema)}.${sql.identifier('role_history')}
        (${sql.join(historyColumns, sql`, `)})
      select ${sql.join(historyColumns, sql`, `)}
        from ${sql.identifier(source)}.${sql.identifier('role_history')}
       where account_id in (${list(members)})
    `);
    await tx.insert(dst.roleHistory).values({
      accountId: targetId,
      role: 'PLATINUM',
      changedBy: auth.accountId,
      changedAt: now,
    });

    // 4. Leave the source: only the person stays, as a marker without a
    // downline (the line above sees the account and when it was promoted).
    if (below.length > 0) {
      await tx
        .delete(src.roleHistory)
        .where(inArray(src.roleHistory.accountId, below));
      await tx
        .delete(src.partners)
        .where(inArray(src.partners.accountId, below));
    }
    await tx
      .update(src.partners)
      .set({ role: 'PLATINUM' })
      .where(eq(src.partners.accountId, targetId));
    await tx.insert(src.roleHistory).values({
      accountId: targetId,
      role: 'PLATINUM',
      changedBy: auth.accountId,
      changedAt: now,
    });

    // 5. The catalog of accounts and the registry of organizations.
    await tx
      .update(accounts)
      .set({ orgSchema: newSchema })
      .where(inArray(accounts.id, realMembers));
    if (markers.length > 0) {
      // The organizations detached earlier from below now hang under this one.
      await tx
        .update(orgSchemas)
        .set({ sourceSchema: newSchema })
        .where(
          and(
            eq(orgSchemas.sourceSchema, source),
            inArray(orgSchemas.rootAccountId, markers),
          ),
        );
    }
    await tx
      .update(orgSchemas)
      .set({
        rootAccountId: targetId,
        sourceSchema: source,
        promotedBy: auth.accountId,
        promotedAt: now,
        previousRecommenderId: target.partner.recommenderId,
      })
      .where(eq(orgSchemas.name, newSchema));

    // 6. Registration links (decision 87): those created inside the moved
    // branch follow it; those created from outside it (the inviter no longer
    // rules over the person they name) expire. SuperAdministrators keep theirs.
    const superAdminInviters = tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.isSuperAdmin, true));
    await tx
      .update(invitations)
      .set({ orgSchema: newSchema })
      .where(
        and(
          isNull(invitations.consumedAt),
          eq(invitations.orgSchema, source),
          inArray(invitations.recommenderAccountId, members),
          sql`(${invitations.inviterAccountId} in (${list(members)})
               or ${invitations.inviterAccountId} in (${superAdminInviters}))`,
        ),
      );
    const expired = await tx
      .update(invitations)
      .set({ expiresAt: now })
      .where(
        and(
          isNull(invitations.consumedAt),
          gt(invitations.expiresAt, now),
          eq(invitations.orgSchema, source),
          sql`(${invitations.recommenderAccountId} in (${list(members)}))
              <> (${invitations.inviterAccountId} in (${list(members)}))`,
          notInArray(invitations.inviterAccountId, superAdminInviters),
        ),
      )
      .returning({
        id: invitations.id,
        recommenderAccountId: invitations.recommenderAccountId,
      });
    for (const invitation of expired) {
      await this.audit.record(tx, {
        actorAccountId: auth.accountId,
        action: 'invitation.revoke',
        objectType: 'invitation',
        objectId: invitation.id,
        subjectAccountId: invitation.recommenderAccountId,
        after: { expiresAt: now, reason: 'promotion' },
        meta,
      });
    }

    // 7. The log and the message to the promoted person.
    await this.audit.record(tx, {
      actorAccountId: auth.accountId,
      action: 'account.promote',
      objectType: 'account',
      objectId: targetId,
      subjectAccountId: targetId,
      before: { role: target.partner.role, orgSchema: source },
      after: {
        role: 'PLATINUM',
        orgSchema: newSchema,
        previousRecommenderId: target.partner.recommenderId,
        movedAccountIds: below,
        detachedBelow: markers,
      },
      meta,
    });
    await this.audit.record(tx, {
      actorAccountId: auth.accountId,
      action: 'organization.create',
      objectType: 'org_schema',
      objectId: newSchema,
      subjectAccountId: targetId,
      after: { name: newSchema, rootAccountId: targetId, sourceSchema: source },
      meta,
    });

    const [owner] = await tx
      .select({ email: accounts.email, locale: accounts.locale })
      .from(accounts)
      .where(eq(accounts.id, targetId));
    if (owner) {
      await this.outbox.enqueue(tx, {
        type: 'promoted',
        recipientEmail: owner.email,
        locale: owner.locale,
        payload: {
          url: `${this.config.get('APP_BASE_URL', { infer: true })}/accounts`,
        },
      });
    }
    return { newSchema, movedAccountIds: realMembers };
  }
}
