import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { RoleEnum } from '../accounts/account.models.js';
import type { Role } from '../db/schema/index.js';

@ObjectType()
export class Mailing {
  @Field(() => ID)
  id!: string;

  @Field()
  subject!: string;

  @Field(() => RoleEnum)
  minRole!: Role;

  @Field(() => Int)
  recipientCount!: number;

  @Field(() => Date)
  createdAt!: Date;

  /** Messages still waiting to be delivered (or being retried). */
  @Field(() => Int)
  pending!: number;

  @Field(() => Int)
  sent!: number;

  @Field(() => Int)
  failed!: number;
}

@InputType()
export class SendOrgMailingInput {
  @Field()
  subject!: string;

  @Field()
  body!: string;

  @Field(() => String, { nullable: true })
  subjectDe?: string | null;

  @Field(() => String, { nullable: true })
  bodyDe?: string | null;

  @Field(() => String, { nullable: true })
  subjectEn?: string | null;

  @Field(() => String, { nullable: true })
  bodyEn?: string | null;

  /** The lowest role that receives it; everybody when left out. */
  @Field(() => RoleEnum, { nullable: true })
  minRole?: Role | null;
}
