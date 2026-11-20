import { Logger } from '@nestjs/common';
import type { MailMessage, MailTransport } from './mail.types.js';

/**
 * Writes the message to the log instead of sending it. The default driver:
 * the app works end to end (the link is in the log) before a sending domain
 * exists. The log contains the registration link, so do not use it where logs
 * are shared.
 */
export class ConsoleTransport implements MailTransport {
  private readonly logger = new Logger('Mail');

  send(message: MailMessage): Promise<void> {
    this.logger.log(
      `To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`,
    );
    return Promise.resolve();
  }
}
