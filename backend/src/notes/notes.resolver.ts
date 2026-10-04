import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CreateNoteInput } from './dto/create-note.input.js';
import { UpdateNoteInput } from './dto/update-note.input.js';
import { Note } from './note.model.js';
import { NotesService } from './notes.service.js';

@Resolver(() => Note)
export class NotesResolver {
  constructor(private readonly notesService: NotesService) {}

  @Query(() => [Note])
  notes() {
    return this.notesService.findAll();
  }

  @Query(() => Note)
  note(@Args('id', { type: () => ID }) id: string) {
    return this.notesService.findOne(id);
  }

  @Mutation(() => Note)
  createNote(@Args('input') input: CreateNoteInput) {
    return this.notesService.create(input);
  }

  @Mutation(() => Note)
  updateNote(@Args('input') input: UpdateNoteInput) {
    return this.notesService.update(input);
  }

  @Mutation(() => Boolean)
  removeNote(@Args('id', { type: () => ID }) id: string) {
    return this.notesService.remove(id);
  }
}
