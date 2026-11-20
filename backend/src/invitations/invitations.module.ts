import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { OrgModule } from '../org/org.module.js';
import { StructureModule } from '../structure/structure.module.js';
import { InvitationsResolver } from './invitations.resolver.js';
import { InvitationsService } from './invitations.service.js';
import { RegistrationResolver } from './registration.resolver.js';
import { RegistrationService } from './registration.service.js';

@Module({
  imports: [AuthModule, AuditModule, OrgModule, StructureModule],
  providers: [
    InvitationsService,
    RegistrationService,
    InvitationsResolver,
    RegistrationResolver,
  ],
})
export class InvitationsModule {}
