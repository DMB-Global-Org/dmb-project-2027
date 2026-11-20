import { Field, ID, ObjectType } from '@nestjs/graphql';
import type { AuthContext } from './auth.types.js';

/** The logged-in account as the client sees it. */
@ObjectType()
export class Viewer {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field()
  role!: string;

  @Field()
  state!: string;

  @Field()
  locale!: string;

  static from(auth: AuthContext): Viewer {
    const viewer = new Viewer();
    viewer.id = auth.accountId;
    viewer.email = auth.email;
    viewer.role = auth.actor.role;
    viewer.state = auth.actor.state;
    viewer.locale = auth.locale;
    return viewer;
  }
}
