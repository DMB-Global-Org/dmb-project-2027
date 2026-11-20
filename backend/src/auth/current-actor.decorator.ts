import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { appError } from '../common/graphql-error.js';
import type { AuthContext, GqlContext } from './auth.types.js';

/** The logged-in account (null only on `@Public()` resolvers). */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext | null =>
    GqlExecutionContext.create(context).getContext<GqlContext>().auth ?? null,
);

/** Like `CurrentAuth` for protected resolvers: the logged-in account, never null. */
export const RequireAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const auth =
      GqlExecutionContext.create(context).getContext<GqlContext>().auth;
    // The global AuthGuard already refused anonymous callers; this keeps the type honest.
    if (!auth) throw appError('UNAUTHENTICATED');
    return auth;
  },
);
