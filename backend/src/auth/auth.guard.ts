import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { appError } from '../common/graphql-error.js';
import { AuthService } from './auth.service.js';
import type { GqlContext } from './auth.types.js';
import { IS_PUBLIC } from './public.decorator.js';

/**
 * Global guard: every GraphQL resolver needs a logged-in account unless it is
 * marked `@Public()`. It also attaches the account to the GraphQL context so
 * public resolvers (e.g. `viewer`) can use it when present.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Plain HTTP routes (the Render health check on `/`) are not GraphQL.
    if (context.getType<string>() !== 'graphql') return true;

    const ctx = GqlExecutionContext.create(context).getContext<GqlContext>();
    // One lookup per request, however many fields it resolves.
    ctx.authResolved ??= this.resolve(ctx);
    await ctx.authResolved;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!ctx.auth && !isPublic) throw appError('UNAUTHENTICATED');
    return true;
  }

  private async resolve(ctx: GqlContext): Promise<void> {
    const result = await this.auth.authenticate(ctx.req);
    ctx.auth = result?.auth ?? null;
    ctx.sessionToken = result?.token ?? null;
  }
}
