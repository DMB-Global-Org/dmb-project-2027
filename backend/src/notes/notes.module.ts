import { Module } from '@nestjs/common';
import { NotesResolver } from './notes.resolver.js';
import { NotesService } from './notes.service.js';

@Module({
  providers: [NotesResolver, NotesService],
})
export class NotesModule {}
