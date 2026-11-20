import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class HealthResolver {
  // GraphQL needs at least one query; also a cheap connectivity check for clients.
  @Query(() => String)
  health(): string {
    return 'ok';
  }
}
