import { Query, Resolver } from '@nestjs/graphql';
import { Public } from '../auth/public.decorator.js';
import { APP_VERSION } from '../config/version.js';

@Resolver()
export class HealthResolver {
  // GraphQL needs at least one query; also a cheap connectivity check for clients.
  @Public()
  @Query(() => String)
  health(): string {
    return 'ok';
  }

  /** Version of the running backend (package.json); shown in the page header. */
  @Public()
  @Query(() => String)
  version(): string {
    return APP_VERSION;
  }
}
