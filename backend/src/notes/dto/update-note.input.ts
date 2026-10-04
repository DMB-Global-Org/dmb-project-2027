import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateNoteInput {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  title?: string;

  @Field(() => String, { nullable: true })
  content?: string | null;
}
