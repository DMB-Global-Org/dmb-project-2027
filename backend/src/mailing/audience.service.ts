import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { AuthContext } from '../auth/auth.types.js';
import { roleLevel } from '../authz/roles.js';
import { DB, type Database } from '../db/database.tokens.js';
import { orgTables } from '../db/org/org-tables.js';
import { accounts, orgSchemas, ROLES, type Role } from '../db/schema/index.js';
import { RelationLoader } from '../structure/relation-loader.js';

export interface Recipient {
  accountId: string;
  email: string;
  locale: string;
}

/**
 * Who receives an organizational mailing (decisions 67 and 88): active
 * Partners with at least the chosen role, in the sender's scope. A Platinum
 * reaches their organization, an Administrator their downline, a
 * SuperAdministrator every organization. The sender is not a recipient, and
 * neither are the markers of detached organizations (those people belong to
 * another organization).
 */
@Injectable()
export class AudienceService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly relations: RelationLoader,
  ) {}

  async recipients(auth: AuthContext, minRole: Role): Promise<Recipient[]> {
    const roles = ROLES.filter(
      (role) =>
        role !== 'SUPER_ADMINISTRATOR' && roleLevel(role) >= roleLevel(minRole),
    );

    const roots: { orgSchema: string; rootId: string }[] = [];
    if (auth.actor.role === 'SUPER_ADMINISTRATOR') {
      const registry = await this.db
        .select({ name: orgSchemas.name, root: orgSchemas.rootAccountId })
        .from(orgSchemas)
        .orderBy(asc(orgSchemas.createdAt));
      for (const org of registry) {
        if (org.root) roots.push({ orgSchema: org.name, rootId: org.root });
      }
    } else if (auth.orgSchema) {
      roots.push({ orgSchema: auth.orgSchema, rootId: auth.accountId });
    }

    const result: Recipient[] = [];
    for (const { orgSchema, rootId } of roots) {
      const ids = (await this.relations.downline(orgSchema, rootId))
        .map((entry) => entry.accountId)
        .filter((id) => id !== auth.accountId);
      if (ids.length === 0) continue;
      const { partners } = orgTables(orgSchema);
      const rows = await this.db
        .select({
          accountId: accounts.id,
          email: accounts.email,
          locale: accounts.locale,
        })
        .from(partners)
        .innerJoin(accounts, eq(accounts.id, partners.accountId))
        .where(
          and(
            inArray(partners.accountId, ids),
            eq(partners.state, 'ACTIVE'),
            isNull(partners.removedAt),
            inArray(partners.role, roles),
            // A marker of a detached organization has its account elsewhere.
            eq(accounts.orgSchema, orgSchema),
          ),
        );
      result.push(...rows);
    }
    return result;
  }
}
