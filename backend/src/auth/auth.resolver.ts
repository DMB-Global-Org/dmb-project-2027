import { Inject } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { z } from 'zod';
import { appError } from '../common/graphql-error.js';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import { AuthService } from './auth.service.js';
import type { AuthContext, GqlContext } from './auth.types.js';
import { requestMeta } from './cookies.js';
import { CurrentAuth } from './current-actor.decorator.js';
import { Public } from './public.decorator.js';
import { Viewer } from './viewer.model.js';

const loginInput = z.object({
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(1024),
});

@Resolver(() => Viewer)
export class AuthResolver {
  constructor(
    private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  /** Who is logged in, or null. Public so the frontend can ask before login. */
  @Public()
  @Query(() => Viewer, { nullable: true })
  viewer(@CurrentAuth() auth: AuthContext | null): Viewer | null {
    return auth ? Viewer.from(auth) : null;
  }

  @Public()
  @Mutation(() => Viewer)
  async login(
    @Args('email') email: string,
    @Args('password') password: string,
    @Context() ctx: GqlContext,
  ): Promise<Viewer> {
    const input = loginInput.safeParse({ email, password });
    if (!input.success) throw appError('VALIDATION_FAILED');

    const result = await this.auth.login(
      input.data.email,
      input.data.password,
      requestMeta(ctx.req),
    );
    ctx.res.cookie(this.config.cookieName, result.token, {
      ...this.cookieOptions(),
      expires: result.expiresAt,
    });
    return Viewer.from(result.auth);
  }

  @Mutation(() => Boolean)
  async logout(@Context() ctx: GqlContext): Promise<boolean> {
    if (ctx.sessionToken) await this.auth.logout(ctx.sessionToken);
    ctx.res.clearCookie(this.config.cookieName, this.cookieOptions());
    return true;
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.secureCookie,
      sameSite: 'lax' as const,
      path: '/',
    };
  }
}
