import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { ConsoleTransport } from './console.transport.js';
import { MAIL_TRANSPORT, type MailTransport } from './mail.types.js';
import { MailerSendTransport } from './mailersend.transport.js';
import { OutboxDispatcher } from './outbox-dispatcher.js';
import { OutboxService } from './outbox.service.js';

@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): MailTransport => {
        if (config.get('MAIL_DRIVER', { infer: true }) !== 'mailersend') {
          return new ConsoleTransport();
        }
        // validateEnv guarantees these two when the driver is mailersend.
        return new MailerSendTransport({
          apiKey: config.get('MAILERSEND_API_KEY', { infer: true })!,
          fromEmail: config.get('MAIL_FROM_EMAIL', { infer: true })!,
          fromName: config.get('MAIL_FROM_NAME', { infer: true }),
        });
      },
    },
    OutboxService,
    OutboxDispatcher,
  ],
  exports: [OutboxService, OutboxDispatcher],
})
export class MailModule {}
