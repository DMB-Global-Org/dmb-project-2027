import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext, RequestMeta } from '../auth/auth.types.js';
import { ActorService } from '../auth/actor.service.js';
import { can } from '../authz/can.js';
import type { Decision } from '../authz/types.js';
import { appError } from '../common/graphql-error.js';
import type { Locale } from '../common/locales.js';
import { DB, type Database } from '../db/database.tokens.js';
import {
  invitations,
  type InvitationKind,
  type InvitationRow,
} from '../db/schema/index.js';
import { TxRunner } from '../db/tx-runner.js';
import { RelationLoader } from '../structure/relation-loader.js';
import {
  hashInvitationToken,
  INVITATION_TTL_MS,
  newInvitationToken,
} from './invitation-token.js';

export interface CreateInvitationInput {
  kind: InvitationKind;
  /** PARTNER only: defaults to the inviter; a SuperAdministrator must name one. */
  recommenderId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  locale: Locale;
}

export type InvitationStatus = 'PENDING' | 'USED' | 'EXPIRED';

export function invitationStatus(
  row: Pick<InvitationRow, 'consumedAt' | 'expiresAt'>,
  now: Date,
): InvitationStatus {
  if (row.consumedAt) return 'USED';
  return row.expiresAt.getTime() > now.getTime() ? 'PENDING' : 'EXPIRED';
}

export function assertAllowed(decision: Decision): void {
  if (!decision.allowed) {
    throw appError('FORBIDDEN', { reason: decision.reason });
  }
}

@Injectable()
export class InvitationsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly tx: TxRunner,
    private readonly relations: RelationLoader,
    private readonly actors: ActorService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Creates a registration link. The token is returned only here; the table
   * keeps its hash, so a link cannot be shown again later.
   */
  async create(
    auth: AuthContext,
    input: CreateInvitationInput,
    meta: RequestMeta,
    now = new Date(),
  ): Promise<{ invitation: InvitationRow; token: string }> {
    return this.tx.run(async (tx) => {
      let recommenderId: string | null = null;
      let orgSchema: string | null = null;

      if (input.kind === 'PLATINUM') {
        if (input.recommenderId) {
          throw appError('VALIDATION_FAILED', { field: 'recommenderId' });
        }
        assertAllowed(can(auth.actor, { action: 'INVITE_PLATINUM' }));
      } else {
        // Decision 69: the inviter names themselves or somebody below them.
        recommenderId =
          input.recommenderId ?? (auth.orgSchema ? auth.accountId : null);
        if (!recommenderId) {
          throw appError('VALIDATION_FAILED', { field: 'recommenderId' });
        }
        const loaded = await this.relations.inviteRecommenderFacts(
          auth,
          recommenderId,
          tx,
        );
        if (!loaded) {
          // Unknown and out-of-scope sponsors look the same: no probing of ids.
          throw appError('FORBIDDEN', {
            reason:
              auth.actor.state === 'ACTIVE'
                ? 'not_in_scope'
                : 'actor_not_active',
          });
        }
        assertAllowed(
          can(auth.actor, { action: 'INVITE', recommender: loaded.facts }),
        );
        orgSchema = loaded.orgSchema;
      }

      const token = newInvitationToken();
      const [invitation] = await tx
        .insert(invitations)
        .values({
          tokenHash: hashInvitationToken(token),
          kind: input.kind,
          inviterAccountId: auth.accountId,
          recommenderAccountId: recommenderId,
          orgSchema,
          recipientEmail: input.recipientEmail ?? null,
          recipientPhone: input.recipientPhone ?? null,
          locale: input.locale,
          // One clock for both, so the lifetime is exactly 72 hours.
          createdAt: now,
          expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
        })
        .returning();

      await this.audit.record(tx, {
        actorAccountId: auth.accountId,
        action: 'invitation.create',
        objectType: 'invitation',
        objectId: invitation!.id,
        subjectAccountId: recommenderId,
        after: {
          kind: input.kind,
          recommenderAccountId: recommenderId,
          orgSchema,
          recipientEmail: input.recipientEmail ?? null,
          recipientPhone: input.recipientPhone ?? null,
          expiresAt: invitation!.expiresAt,
        },
        meta,
      });
      return { invitation: invitation!, token };
    });
  }

  /** The invitations the account created, newest first, with their state. */
  async listOwn(auth: AuthContext): Promise<InvitationRow[]> {
    return this.db
      .select()
      .from(invitations)
      .where(eq(invitations.inviterAccountId, auth.accountId))
      .orderBy(desc(invitations.createdAt))
      .limit(100);
  }

  /**
   * The invitation behind a link, if the link can still be used: not saved yet,
   * not past 72 hours, and its inviter may still invite (decision 73: links of
   * a deactivated inviter lose validity). Null otherwise, without saying why.
   */
  async findUsable(
    token: string,
    now = new Date(),
  ): Promise<InvitationRow | null> {
    const [row] = await this.db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.tokenHash, hashInvitationToken(token)),
          isNull(invitations.consumedAt),
          gt(invitations.expiresAt, now),
        ),
      );
    if (!row) return null;
    return (await this.inviterMayInvite(row.inviterAccountId)) ? row : null;
  }

  async inviterMayInvite(inviterAccountId: string): Promise<boolean> {
    const inviter = await this.actors.load(inviterAccountId);
    return inviter?.actor.state === 'ACTIVE';
  }
}
