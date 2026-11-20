import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { DB, type Database } from '../db/database.tokens.js';
import { sessions } from '../db/schema/index.js';
import type { Tx } from '../db/tx-runner.js';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import type { RequestMeta } from './auth.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  /** Starts a session; the returned token goes into the cookie, only its hash is stored. */
  async create(
    accountId: string,
    meta: RequestMeta,
    now = new Date(),
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      now.getTime() + this.config.sessionTtlDays * DAY_MS,
    );
    await this.db.insert(sessions).values({
      tokenHash: hashSessionToken(token),
      accountId,
      expiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    // Housekeeping: forget sessions that ended more than a week ago.
    await this.db
      .delete(sessions)
      .where(lt(sessions.expiresAt, new Date(now.getTime() - 7 * DAY_MS)));
    return { token, expiresAt };
  }

  /** The session behind a token, or null when it is unknown, revoked or expired. */
  async resolve(
    token: string,
    now = new Date(),
  ): Promise<{ sessionId: string; accountId: string } | null> {
    const [row] = await this.db
      .select({ sessionId: sessions.id, accountId: sessions.accountId })
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenHash, hashSessionToken(token)),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
        ),
      );
    return row ?? null;
  }

  async revoke(token: string, now = new Date()): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(sessions.tokenHash, hashSessionToken(token)),
          isNull(sessions.revokedAt),
        ),
      );
  }

  /**
   * Cuts an account off everywhere. Pass the caller's transaction so the
   * revocation commits together with the change that caused it (deactivation).
   */
  async revokeAllFor(
    accountId: string,
    executor: Database | Tx = this.db,
    now = new Date(),
  ): Promise<void> {
    await executor
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(eq(sessions.accountId, accountId), isNull(sessions.revokedAt)),
      );
  }
}
