import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../db/database.tokens.js';
import { orgTables } from '../db/org/org-tables.js';
import { accounts } from '../db/schema/index.js';
import type { AuthContext } from './auth.types.js';

@Injectable()
export class ActorService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Who an account is right now: its role and state come from the Partner row
   * in its organization schema; SuperAdministrators have no such row.
   * Null for an unknown account or one without a Partner row.
   */
  async load(accountId: string): Promise<AuthContext | null> {
    const [account] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId));
    if (!account) return null;

    const base = {
      accountId: account.id,
      email: account.email,
      locale: account.locale,
    };

    if (account.isSuperAdmin) {
      return {
        ...base,
        orgSchema: null,
        actor: {
          accountId: account.id,
          role: 'SUPER_ADMINISTRATOR',
          state: 'ACTIVE',
        },
      };
    }

    if (!account.orgSchema) return null;
    const { partners } = orgTables(account.orgSchema);
    const [partner] = await this.db
      .select({ role: partners.role, state: partners.state })
      .from(partners)
      .where(eq(partners.accountId, account.id));
    if (!partner) return null;

    return {
      ...base,
      orgSchema: account.orgSchema,
      actor: {
        accountId: account.id,
        role: partner.role,
        state: partner.state,
      },
    };
  }
}
