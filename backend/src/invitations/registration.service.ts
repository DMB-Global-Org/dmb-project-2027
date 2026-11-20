import { Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { ActorService } from '../auth/actor.service.js';
import type { AuthContext, RequestMeta } from '../auth/auth.types.js';
import { hashPassword } from '../auth/password.js';
import { SessionService } from '../auth/session.service.js';
import { appError } from '../common/graphql-error.js';
import {
  pgConstraintName,
  pgErrorCode,
  PG_UNIQUE_VIOLATION,
} from '../db/pg-error.js';
import { orgTables } from '../db/org/org-tables.js';
import { accounts, invitations, orgSchemas } from '../db/schema/index.js';
import { TxRunner } from '../db/tx-runner.js';
import { OrgSchemaService } from '../org/org-schema.service.js';
import { hashInvitationToken } from './invitation-token.js';
import { InvitationsService } from './invitations.service.js';

export interface RegistrationInput {
  email: string;
  password: string;
  /** ISO 3166-1 alpha-2, upper case. */
  country: string;
  partnerNumber: string;
}

export interface RegistrationResult {
  auth: AuthContext;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class RegistrationService {
  constructor(
    private readonly tx: TxRunner,
    private readonly invitations: InvitationsService,
    private readonly orgs: OrgSchemaService,
    private readonly actors: ActorService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Saves the account behind a registration link and logs it in. Everything
   * happens in one transaction: using up the link, creating the account, its
   * Partner row and (for a Platinum link) the new organization schema. Any
   * failure leaves the link usable and nothing behind.
   */
  async register(
    token: string,
    input: RegistrationInput,
    meta: RequestMeta,
    now = new Date(),
  ): Promise<RegistrationResult> {
    // Cheap check first: do not spend a password hash on a dead link.
    if (!(await this.invitations.findUsable(token, now))) {
      throw appError('INVITATION_INVALID');
    }
    const passwordHash = await hashPassword(input.password);

    const accountId = await this.tx.run(async (tx) => {
      // Lock the row: of two simultaneous saves with one link, the second
      // waits, then sees it used (the condition is re-checked after the lock).
      const [invitation] = await tx
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.tokenHash, hashInvitationToken(token)),
            isNull(invitations.consumedAt),
            gt(invitations.expiresAt, now),
          ),
        )
        .for('update');
      if (
        !invitation ||
        !(await this.invitations.inviterMayInvite(invitation.inviterAccountId))
      ) {
        throw appError('INVITATION_INVALID');
      }

      const isPlatinum = invitation.kind === 'PLATINUM';
      // A Platinum link founds a new organization (decision 68).
      const orgSchema = isPlatinum
        ? await this.orgs.create(tx)
        : invitation.orgSchema!;

      let account: { id: string };
      try {
        [account] = await tx
          .insert(accounts)
          .values({
            email: input.email,
            passwordHash,
            orgSchema,
            locale: invitation.locale,
            partnerNumber: input.partnerNumber,
            partnerCountry: input.country,
          })
          .returning({ id: accounts.id });
      } catch (error) {
        if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
          const constraint = pgConstraintName(error);
          if (constraint === 'accounts_email_key')
            throw appError('EMAIL_TAKEN');
          if (constraint === 'accounts_partner_number_key') {
            throw appError('PARTNER_NUMBER_TAKEN');
          }
        }
        throw error;
      }
      const newId = account!.id;

      const role = isPlatinum ? 'PLATINUM' : 'GENERAL';
      const { partners, roleHistory } = orgTables(orgSchema);
      await tx.insert(partners).values({
        accountId: newId,
        role,
        // Both stages of activation still ahead (decisions 73, 76).
        state: 'PENDING_ACTIVATION',
        recommenderId: invitation.recommenderAccountId,
        invitedById: invitation.inviterAccountId,
      });
      await tx.insert(roleHistory).values({
        accountId: newId,
        role,
        changedBy: invitation.inviterAccountId,
      });
      if (isPlatinum) {
        await tx
          .update(orgSchemas)
          .set({ rootAccountId: newId })
          .where(eq(orgSchemas.name, orgSchema));
      }

      await tx
        .update(invitations)
        .set({ consumedAt: now, consumedByAccountId: newId })
        .where(eq(invitations.id, invitation.id));

      await this.audit.record(tx, {
        actorAccountId: newId,
        action: 'account.register',
        objectType: 'account',
        objectId: newId,
        subjectAccountId: newId,
        after: {
          orgSchema,
          role,
          state: 'PENDING_ACTIVATION',
          recommenderId: invitation.recommenderAccountId,
          invitedById: invitation.inviterAccountId,
          invitationId: invitation.id,
        },
        meta,
      });
      if (isPlatinum) {
        await this.audit.record(tx, {
          actorAccountId: invitation.inviterAccountId,
          action: 'organization.create',
          objectType: 'org_schema',
          objectId: orgSchema,
          subjectAccountId: newId,
          after: { name: orgSchema, rootAccountId: newId },
          meta,
        });
      }
      return newId;
    });

    const session = await this.sessions.create(accountId, meta, now);
    const auth = await this.actors.load(accountId);
    // Not reachable: the account and its Partner row were just committed.
    if (!auth) throw new Error('Registered account cannot be loaded');
    return { auth, token: session.token, expiresAt: session.expiresAt };
  }
}
