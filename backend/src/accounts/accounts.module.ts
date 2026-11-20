import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { MailModule } from '../mail/mail.module.js';
import { StructureModule } from '../structure/structure.module.js';
import { AccountsResolver } from './accounts.resolver.js';
import { AccountsService } from './accounts.service.js';

@Module({
  imports: [AuthModule, AuditModule, MailModule, StructureModule],
  providers: [AccountsService, AccountsResolver],
})
export class AccountsModule {}
