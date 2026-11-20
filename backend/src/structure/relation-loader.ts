import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { InviteRecommenderFacts } from '../authz/types.js';
import type { AuthContext } from '../auth/auth.types.js';
import { DB, type Database } from '../db/database.tokens.js';
import { assertOrgSchemaName, orgTables } from '../db/org/org-tables.js';
import { accounts } from '../db/schema/index.js';
import type { Tx } from '../db/tx-runner.js';

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
}
