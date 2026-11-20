import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { InviteRecommenderFacts, TargetFacts } from '../authz/types.js';
import type { AuthContext } from '../auth/auth.types.js';
import { DB, type Database } from '../db/database.tokens.js';
import { assertOrgSchemaName, orgTables } from '../db/org/org-tables.js';
import { accounts, orgSchemas } from '../db/schema/index.js';
import type { Tx } from '../db/tx-runner.js';

export type PartnerRow = ReturnType<
  typeof orgTables
>['partners']['$inferSelect'];

/** A target of an administrative action, with the facts the engine needs. */
export interface LoadedTarget {
  facts: TargetFacts;
  orgSchema: string;
  partner: PartnerRow;
}

/** One member of a downline, in tree order. */
export interface DownlineEntry {
  accountId: string;
  depth: number;
}

/**
 * Computes the facts the permission engine needs (see authz/types.ts) from the
 * sponsor tree of an organization schema. The engine itself never touches the
 * database.
 */
@Injectable()
export class RelationLoader {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Is `ancestorId` the same account as `descendantId`, or somewhere above it
   * in the sponsor chain of `orgSchema`? Walks up from the descendant; UNION
   * (not UNION ALL) keeps a corrupted, cyclic chain from looping forever.
   */
  async isSelfOrAncestor(
    orgSchema: string,
    ancestorId: string,
    descendantId: string,
    executor: Database | Tx = this.db,
  ): Promise<boolean> {
    if (ancestorId === descendantId) return true;
    assertOrgSchemaName(orgSchema);
    const partners = sql`${sql.identifier(orgSchema)}.${sql.identifier('partners')}`;
    const rows = await executor.execute(sql`
      with recursive chain(account_id, recommender_id) as (
        select account_id, recommender_id from ${partners}
          where account_id = ${descendantId}
        union
        select p.account_id, p.recommender_id from ${partners} p
          join chain c on p.account_id = c.recommender_id
      )
      select 1 from chain where account_id = ${ancestorId} limit 1
    `);
    return rows.length > 0;
  }

  /**
   * Facts about the sponsor named in an invitation, plus the organization they
   * belong to. Null when the account is unknown, a SuperAdministrator or has no
   * Partner row: such an account cannot be a sponsor.
   */
  async inviteRecommenderFacts(
    actor: AuthContext,
    recommenderId: string,
    executor: Database | Tx = this.db,
  ): Promise<{ facts: InviteRecommenderFacts; orgSchema: string } | null> {
    const [account] = await executor
      .select({ orgSchema: accounts.orgSchema })
      .from(accounts)
      .where(eq(accounts.id, recommenderId));
    if (!account?.orgSchema) return null;

    const { partners } = orgTables(account.orgSchema);
    const [partner] = await executor
      .select({ state: partners.state })
      .from(partners)
      .where(eq(partners.accountId, recommenderId));
    if (!partner) return null;

    const actorIsAncestorOrSelf =
      actor.orgSchema === account.orgSchema &&
      (await this.isSelfOrAncestor(
        account.orgSchema,
        actor.accountId,
        recommenderId,
        executor,
      ));

    return {
      orgSchema: account.orgSchema,
      facts: {
        actorIsAncestorOrSelf,
        state: partner.state,
        // Removal from the structure arrives with PR8 (decision 72).
        removed: false,
      },
    };
  }

  /**
   * The account an action is aimed at, with its facts relative to the actor.
   * Null when it does not exist or is not a Partner (a SuperAdministrator
   * cannot be a target). Pass `lock` inside a transaction to hold the Partner
   * row until it ends, so two simultaneous changes are serialized and the
   * decision is made on the state that will actually be changed.
   */
  async targetFacts(
    actor: AuthContext,
    targetAccountId: string,
    executor: Database | Tx = this.db,
    options: { lock?: boolean } = {},
  ): Promise<LoadedTarget | null> {
    const [account] = await executor
      .select({ orgSchema: accounts.orgSchema })
      .from(accounts)
      .where(eq(accounts.id, targetAccountId));
    if (!account?.orgSchema) return null;

    const { partners } = orgTables(account.orgSchema);
    const query = executor
      .select()
      .from(partners)
      .where(eq(partners.accountId, targetAccountId));
    const [partner] = await (options.lock ? query.for('update') : query);
    if (!partner) return null;

    const [registry] = await executor
      .select({ rootAccountId: orgSchemas.rootAccountId })
      .from(orgSchemas)
      .where(eq(orgSchemas.name, account.orgSchema));

    const isSelf = actor.accountId === targetAccountId;
    const sameOrg = actor.orgSchema === account.orgSchema;
    const actorIsAncestor =
      !isSelf &&
      sameOrg &&
      (await this.isSelfOrAncestor(
        account.orgSchema,
        actor.accountId,
        targetAccountId,
        executor,
      ));

    return {
      orgSchema: account.orgSchema,
      partner,
      facts: {
        role: partner.role,
        state: partner.state,
        // Removal from the structure arrives with PR8 (decision 72).
        removed: false,
        isSelf,
        sameOrg,
        actorIsAncestor,
        isOrgRoot: registry?.rootAccountId === targetAccountId,
        // Known only once promotions record the organization they detached
        // from (PR9); until then nobody stands "above" an organization.
        actorIsAboveOrg: false,
      },
    };
  }

  /**
   * `rootId` and everybody below it in the sponsor tree of `orgSchema`, parents
   * before children, siblings by registration time. A visited-ids guard keeps
   * a corrupted, cyclic chain from looping forever.
   */
  async downline(
    orgSchema: string,
    rootId: string,
    executor: Database | Tx = this.db,
  ): Promise<DownlineEntry[]> {
    assertOrgSchemaName(orgSchema);
    const partners = sql`${sql.identifier(orgSchema)}.${sql.identifier('partners')}`;
    const rows = await executor.execute<{ account_id: string; depth: number }>(
      sql`
      with recursive tree(account_id, depth, ids, path) as (
        select account_id, 0, array[account_id], array[created_at]
          from ${partners} where account_id = ${rootId}
        union all
        select p.account_id, t.depth + 1, t.ids || p.account_id, t.path || p.created_at
          from ${partners} p
          join tree t on p.recommender_id = t.account_id
          where p.account_id <> all(t.ids)
      )
      select account_id, depth from tree order by path, account_id
    `,
    );
    return rows.map((row) => ({
      accountId: row.account_id,
      depth: Number(row.depth),
    }));
  }
}
