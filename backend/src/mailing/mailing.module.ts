import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { MailModule } from '../mail/mail.module.js';
import { StructureModule } from '../structure/structure.module.js';
import { AudienceService } from './audience.service.js';
import { MailingResolver } from './mailing.resolver.js';
import { MailingService } from './mailing.service.js';

@Module({
  imports: [AuthModule, AuditModule, MailModule, StructureModule],
  providers: [AudienceService, MailingService, MailingResolver],
})
export class MailingModule {}
