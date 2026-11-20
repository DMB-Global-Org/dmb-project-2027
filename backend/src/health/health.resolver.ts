import { Query, Resolver } from '@nestjs/graphql';
import { Public } from '../auth/public.decorator.js';

@Resolver()
export class HealthResolver {
  // GraphQL needs at least one query; also a cheap connectivity check for clients.
  @Public()
  @Query(() => String)
  health(): string {
    return 'ok';
  }
}
