import { Inject, Injectable } from '@nestjs/common';
import type { RequestMeta } from '../auth/auth.types.js';
import { DB, type Database } from '../db/database.tokens.js';
import { auditLog } from '../db/schema/index.js';
import type { Tx } from '../db/tx-runner.js';

export interface AuditEntry {
  /** Null for operations the system starts itself. */
  actorAccountId: string | null;
  /** e.g. `invitation.create`, `account.register`. */
  action: string;
  objectType: string;
  objectId?: string | null;
  /** The account the operation concerns; decides who may see the entry. */
  subjectAccountId?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: RequestMeta;
}

/**
 * Writes the system log (rule 9). Pass the transaction of the operation, so
 * the entry commits or rolls back together with it. Never put secrets (password
 * hashes, tokens) in `before`/`after`: the log is never deleted.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async record(
    executor: Database | Tx = this.db,
    entry: AuditEntry,
  ): Promise<void> {
    await executor.insert(auditLog).values({
      actorAccountId: entry.actorAccountId,
      action: entry.action,
      objectType: entry.objectType,
      objectId: entry.objectId ?? null,
      subjectAccountId: entry.subjectAccountId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      ip: entry.meta?.ip ?? null,
      userAgent: entry.meta?.userAgent ?? null,
    });
  }
}
