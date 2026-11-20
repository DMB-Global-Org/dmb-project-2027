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
    },
  ): Promise<string> {
    const [row] = await executor
      .insert(notifications)
      .values({
        type: message.type,
        recipientEmail: message.recipientEmail,
        locale: message.locale,
        payload: message.payload,
      })
      .returning({ id: notifications.id });
    return row!.id;
  }
}
