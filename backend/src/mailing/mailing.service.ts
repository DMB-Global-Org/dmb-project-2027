import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext, RequestMeta } from '../auth/auth.types.js';
import { can } from '../authz/can.js';
import { appError } from '../common/graphql-error.js';
import { DB, type Database } from '../db/database.tokens.js';
import { orgTables } from '../db/org/org-tables.js';
import {
  accounts,
  mailings,
  notifications,
  type MailingContent,
  type MailingRow,
  type Role,
} from '../db/schema/index.js';
import { TxRunner } from '../db/tx-runner.js';
import { OutboxService } from '../mail/outbox.service.js';
import { AudienceService } from './audience.service.js';
import type { SendOrgMailing } from './mailing.schemas.js';

/** More than this in one send is refused (decision 88). */
export const MAX_RECIPIENTS = 2000;

export interface MailingSummary extends MailingRow {
  pending: number;
  sent: number;
  failed: number;
}

@Injectable()
export class MailingService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly tx: TxRunner,
    private readonly audience: AudienceService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  private assertMayMail(auth: AuthContext): void {
    const decision = can(auth.actor, { action: 'SEND_ORG_MAILING' });
    if (!decision.allowed) {
      throw appError('FORBIDDEN', { reason: decision.reason });
    }
  }

  /** How many people a mailing from the caller would reach (for the preview). */
  async audienceSize(auth: AuthContext, minRole: Role): Promise<number> {
    this.assertMayMail(auth);
    return (await this.audience.recipients(auth, minRole)).length;
  }

  /**
   * Queues one e-mail per recipient and records the send, in one transaction:
   * either everybody is queued and the send is in the history, or nothing is.
   */
  async send(
    auth: AuthContext,
    input: SendOrgMailing,
    meta: RequestMeta,
  ): Promise<MailingSummary> {
    this.assertMayMail(auth);
    const minRole = input.minRole as Role;
    const recipients = await this.audience.recipients(auth, minRole);
    if (recipients.length === 0) throw appError('NO_RECIPIENTS');
    if (recipients.length > MAX_RECIPIENTS) {
      throw appError('VALIDATION_FAILED', { field: 'recipients' });
    }

    const translations: Record<string, MailingContent> = {};
    if (input.subjectDe && input.bodyDe) {
      translations.de = { subject: input.subjectDe, body: input.bodyDe };
    }
    if (input.subjectEn && input.bodyEn) {
      translations.en = { subject: input.subjectEn, body: input.bodyEn };
    }

    return this.tx.run(async (tx) => {
      const [mailing] = await tx
        .insert(mailings)
        .values({
          senderAccountId: auth.accountId,
          minRole,
          subject: input.subject,
          body: input.body,
          translations: Object.keys(translations).length ? translations : null,
          recipientCount: recipients.length,
        })
        .returning();

      const senderName = await this.senderName(auth);
      const content: Record<string, MailingContent> = {
        pl: { subject: input.subject, body: input.body },
        ...translations,
      };
      await this.outbox.enqueueMany(
        tx,
        recipients.map((recipient) => ({
          type: 'orgMailing' as const,
          recipientEmail: recipient.email,
          locale: recipient.locale,
          payload: { senderName, content },
          mailingId: mailing!.id,
        })),
      );

      // Counts and languages only: neither the text nor the recipients go to the log.
      await this.audit.record(tx, {
        actorAccountId: auth.accountId,
        action: 'mailing.send',
        objectType: 'mailing',
        objectId: mailing!.id,
        after: {
          minRole,
          recipientCount: recipients.length,
          languages: Object.keys(content),
        },
        meta,
      });
      return {
        ...mailing!,
        pending: recipients.length,
        sent: 0,
        failed: 0,
      };
    });
  }

  /** The caller's own mailings, newest first, with how far delivery has got. */
  async history(auth: AuthContext): Promise<MailingSummary[]> {
    this.assertMayMail(auth);
    const rows = await this.db
      .select()
      .from(mailings)
      .where(eq(mailings.senderAccountId, auth.accountId))
      .orderBy(desc(mailings.createdAt))
      .limit(50);
    if (rows.length === 0) return [];

    const counts = await this.db
      .select({
        mailingId: notifications.mailingId,
        status: notifications.status,
        n: sql<number>`count(*)::int`,
      })
      .from(notifications)
      .where(
        inArray(
          notifications.mailingId,
          rows.map((row) => row.id),
        ),
      )
      .groupBy(notifications.mailingId, notifications.status);

    return rows.map((row) => {
      const of = (status: string) =>
        counts.find((c) => c.mailingId === row.id && c.status === status)?.n ??
        0;
      return {
        ...row,
        pending: of('PENDING'),
        sent: of('SENT'),
        failed: of('FAILED'),
      };
    });
  }

  /** Name for the footer: first and last name, or the e-mail when there is none yet. */
  private async senderName(auth: AuthContext): Promise<string> {
    if (auth.orgSchema) {
      const { partners } = orgTables(auth.orgSchema);
      const [partner] = await this.db
        .select({ firstName: partners.firstName, lastName: partners.lastName })
        .from(partners)
        .where(eq(partners.accountId, auth.accountId));
      const name = [partner?.firstName, partner?.lastName]
        .filter(Boolean)
        .join(' ');
      if (name) return name;
    }
    const [account] = await this.db
      .select({ email: accounts.email })
      .from(accounts)
      .where(eq(accounts.id, auth.accountId));
    return account?.email ?? auth.email;
  }
}
