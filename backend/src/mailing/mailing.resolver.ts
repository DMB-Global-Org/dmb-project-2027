import { Args, Context, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { z } from 'zod';
import { RoleEnum } from '../accounts/account.models.js';
import type { AuthContext, GqlContext } from '../auth/auth.types.js';
import { requestMeta } from '../auth/cookies.js';
import { RequireAuth } from '../auth/current-actor.decorator.js';
import { firstInvalidField } from '../common/field-schemas.js';
import { appError } from '../common/graphql-error.js';
import type { Role } from '../db/schema/index.js';
import { Mailing, SendOrgMailingInput } from './mailing.models.js';
import { minRoleSchema, sendOrgMailingSchema } from './mailing.schemas.js';
import { MailingService } from './mailing.service.js';

@Resolver(() => Mailing)
export class MailingResolver {
  constructor(private readonly mailing: MailingService) {}

  /** How many people a mailing from the caller would reach. */
  @Query(() => Int)
  mailingAudience(
    @Args('minRole', { type: () => RoleEnum, nullable: true })
    minRole: Role | null,
    @RequireAuth() auth: AuthContext,
  ): Promise<number> {
    const parsed = minRoleSchema
      .default('GENERAL')
      .safeParse(minRole ?? undefined);
    if (!parsed.success) {
      throw appError('VALIDATION_FAILED', { field: 'minRole' });
    }
    return this.mailing.audienceSize(auth, parsed.data as Role);
  }

  /** Sends an organizational mailing (Platinum and above, within their scope). */
  @Mutation(() => Mailing)
  async sendOrgMailing(
    @Args('input') input: SendOrgMailingInput,
    @RequireAuth() auth: AuthContext,
    @Context() ctx: GqlContext,
  ): Promise<Mailing> {
    const parsed = sendOrgMailingSchema.safeParse(input);
    if (!parsed.success) {
      throw appError('VALIDATION_FAILED', {
        field: firstInvalidField(parsed.error as z.ZodError),
      });
    }
    return this.mailing.send(auth, parsed.data, requestMeta(ctx.req));
  }

  /** The caller's own mailings, newest first. */
  @Query(() => [Mailing])
  myMailings(@RequireAuth() auth: AuthContext): Promise<Mailing[]> {
    return this.mailing.history(auth);
  }
}
