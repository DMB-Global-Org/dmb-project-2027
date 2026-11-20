import { Inject, Injectable } from '@nestjs/common';
import { DB, type Database } from '../db/database.tokens.js';
import { notifications } from '../db/schema/index.js';
import type { Tx } from '../db/tx-runner.js';
import type {
  NotificationPayloads,
  NotificationType,
} from './templates/index.js';

@Injectable()
export class OutboxService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Queues an e-mail. Pass the transaction of the business operation: the
   * message then exists exactly when the operation committed, and nothing is
   * sent for one that rolled back.
   */
  async enqueue<T extends NotificationType>(
    executor: Database | Tx = this.db,
    message: {
      type: T;
      recipientEmail: string;
      locale: string;
      payload: NotificationPayloads[T];
      /** The organizational mailing the message belongs to, if any. */
      mailingId?: string;
    },
  ): Promise<string> {
    const [row] = await executor
      .insert(notifications)
      .values({
        type: message.type,
        recipientEmail: message.recipientEmail,
        locale: message.locale,
        payload: message.payload,
        mailingId: message.mailingId ?? null,
      })
      .returning({ id: notifications.id });
    return row!.id;
  }

  /**
   * Queues many messages of one type in a few statements (a mailing to a whole
   * organization). Same rules as `enqueue`: pass the transaction of the
   * operation.
   */
  async enqueueMany<T extends NotificationType>(
    executor: Database | Tx,
    messages: {
      type: T;
      recipientEmail: string;
      locale: string;
      payload: NotificationPayloads[T];
      mailingId?: string;
    }[],
  ): Promise<void> {
    const CHUNK = 500;
    for (let from = 0; from < messages.length; from += CHUNK) {
      await executor.insert(notifications).values(
        messages.slice(from, from + CHUNK).map((message) => ({
          type: message.type,
          recipientEmail: message.recipientEmail,
          locale: message.locale,
          payload: message.payload,
          mailingId: message.mailingId ?? null,
        })),
      );
    }
  }
}
