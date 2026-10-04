import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DB, type Database } from '../db/database.module.js';
import { notes, type NoteRow } from '../db/schema/index.js';
import type { CreateNoteInput } from './dto/create-note.input.js';
import type { UpdateNoteInput } from './dto/update-note.input.js';

@Injectable()
export class NotesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  findAll(): Promise<NoteRow[]> {
    return this.db.select().from(notes).orderBy(desc(notes.createdAt));
  }

  async findOne(id: string): Promise<NoteRow> {
    const [note] = await this.db.select().from(notes).where(eq(notes.id, id));
    if (!note) throw new NotFoundException(`Note ${id} not found`);
    return note;
  }

  async create(input: CreateNoteInput): Promise<NoteRow> {
    const [note] = await this.db.insert(notes).values(input).returning();
    return note;
  }

  async update({ id, ...changes }: UpdateNoteInput): Promise<NoteRow> {
    const [note] = await this.db
      .update(notes)
      .set(changes)
      .where(eq(notes.id, id))
      .returning();
    if (!note) throw new NotFoundException(`Note ${id} not found`);
    return note;
  }

  async remove(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(notes)
      .where(eq(notes.id, id))
      .returning({ id: notes.id });
    return deleted.length > 0;
  }
}
