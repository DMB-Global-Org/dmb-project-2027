import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Note {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field(() => String, { nullable: true })
  content: string | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
