import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import type { Env } from '../config/env.js';
import { DB, type Database } from '../db/database.tokens.js';
import { notifications, type NotificationRow } from '../db/schema/index.js';
import { TxRunner } from '../db/tx-runner.js';
import { MAIL_TRANSPORT, MailError, type MailTransport } from './mail.types.js';
import {
  isNotificationType,
  type NotificationPayloads,
  renderMail,
} from './templates/index.js';

/** After this many tries a message is given up (status FAILED). */
export const MAX_ATTEMPTS = 5;
/** While a send is in flight the row is leased; a crash frees it after this. */
export const LEASE_MS = 5 * 60 * 1000;
const BATCH_SIZE = 10;
const MINUTE_MS = 60 * 1000;
// Pause after the 1st, 2nd, 3rd, ... failed attempt.
const BACKOFF_MS = [1, 5, 30, 120].map((minutes) => minutes * MINUTE_MS);

export function retryDelayMs(attempts: number): number {
  return BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length) - 1]!;
}

export interface DispatchResult {
  sent: number;
  retrying: number;
  failed: number;
}

/**
 * Sends the outbox: picks due messages, sends them one by one and records the
 * outcome. Safe to run on several instances at once: rows are claimed with
 * `FOR UPDATE SKIP LOCKED` and leased, so a message is not sent twice at the
 * same time. Delivery is at least once: a crash during a send may repeat it.
 */
@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<unknown> | undefined;

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly tx: TxRunner,
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    const intervalMs =
      this.config.get('NODE_ENV', { infer: true }) === 'test'
        ? 0
        : this.config.get('MAIL_DISPATCH_INTERVAL_MS', { infer: true });
    if (intervalMs <= 0) return;
    this.timer = setInterval(() => void this.tick(), intervalMs);
    this.timer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }

  private async tick(): Promise<void> {
    if (this.running) return; // the previous round is still going
    this.running = this.runOnce().catch((error: unknown) =>
      this.logger.error(`Outbox dispatch failed: ${String(error)}`),
    );
    try {
      await this.running;
    } finally {
      this.running = undefined;
    }
  }

  async runOnce(now = new Date()): Promise<DispatchResult> {
    const claimed = await this.claim(now);
    const result: DispatchResult = { sent: 0, retrying: 0, failed: 0 };
    for (const row of claimed) {
      const outcome = await this.deliver(row, now);
      if (outcome === 'sent') result.sent++;
      else if (outcome === 'retrying') result.retrying++;
      else result.failed++;
    }
    return result;
  }

  /** Takes due rows and leases them, counting the attempt. */
  private claim(now: Date): Promise<NotificationRow[]> {
    return this.tx.run(async (tx) => {
      const due = await tx
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.status, 'PENDING'),
            lte(notifications.nextAttemptAt, now),
          ),
        )
        .orderBy(notifications.nextAttemptAt)
        .limit(BATCH_SIZE)
        .for('update', { skipLocked: true });
      if (due.length === 0) return [];
      return tx
        .update(notifications)
        .set({
          attempts: sql`${notifications.attempts} + 1`,
          nextAttemptAt: new Date(now.getTime() + LEASE_MS),
        })
        .where(
          inArray(
            notifications.id,
            due.map((row) => row.id),
          ),
        )
        .returning();
    });
  }

  private async deliver(
    row: NotificationRow,
    now: Date,
  ): Promise<'sent' | 'retrying' | 'failed'> {
    try {
      if (!isNotificationType(row.type) || row.payload == null) {
        throw new MailError(`Cannot render notification ${row.id}`, true);
      }
      const message = renderMail(
        row.type,
        row.payload as NotificationPayloads[typeof row.type],
        row.locale,
        row.recipientEmail,
      );
      await this.transport.send(message);
      await this.db
        .update(notifications)
        .set({ status: 'SENT', sentAt: now, payload: null, lastError: null })
        .where(eq(notifications.id, row.id));
      return 'sent';
    } catch (error) {
      const permanent = error instanceof MailError && error.permanent;
      const giveUp = permanent || row.attempts >= MAX_ATTEMPTS;
      const lastError = (
        error instanceof Error ? error.message : String(error)
      ).slice(0, 500);
      this.logger.warn(
        `Mail ${row.id} (attempt ${row.attempts}) failed${giveUp ? ', giving up' : ''}: ${lastError}`,
      );
      await this.db
        .update(notifications)
        .set(
          giveUp
            ? { status: 'FAILED', payload: null, lastError }
            : {
                nextAttemptAt: new Date(
                  now.getTime() + retryDelayMs(row.attempts),
                ),
                lastError,
              },
        )
        .where(eq(notifications.id, row.id));
      return giveUp ? 'failed' : 'retrying';
    }
  }
}
