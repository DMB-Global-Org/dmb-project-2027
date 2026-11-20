import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { AuthContext, GqlContext } from './auth.types.js';

/** The logged-in account (null only on `@Public()` resolvers). */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext | null =>
    GqlExecutionContext.create(context).getContext<GqlContext>().auth ?? null,
);
