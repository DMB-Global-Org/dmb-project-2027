import { Module } from '@nestjs/common';
import { OrgSchemaService } from './org-schema.service.js';

@Module({
  providers: [OrgSchemaService],
  exports: [OrgSchemaService],
})
export class OrgModule {}
