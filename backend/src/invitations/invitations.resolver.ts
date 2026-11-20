import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/public.decorator.js';
import type { AuthContext, GqlContext } from '../auth/auth.types.js';
import { requestMeta } from '../auth/cookies.js';
import { RequireAuth } from '../auth/current-actor.decorator.js';
import { appError } from '../common/graphql-error.js';
import type { Env } from '../config/env.js';
import {
  CreatedInvitation,
  CreateInvitationInput,
  Invitation,
  InvitationPreview,
} from './invitation.models.js';
import {
  createInvitationSchema,
  firstInvalidField,
} from './invitation.schemas.js';
import { InvitationsService } from './invitations.service.js';

@Resolver(() => Invitation)
export class InvitationsResolver {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Creates a registration link; the permission engine decides who may. */
  @Mutation(() => CreatedInvitation)
  async createInvitation(
    @Args('input') input: CreateInvitationInput,
    @RequireAuth() auth: AuthContext,
    @Context() ctx: GqlContext,
  ): Promise<CreatedInvitation> {
    const parsed = createInvitationSchema.safeParse(input);
    if (!parsed.success) {
      throw appError('VALIDATION_FAILED', {
        field: firstInvalidField(parsed.error),
      });
    }
    const { invitation, token } = await this.invitations.create(
      auth,
      parsed.data,
      requestMeta(ctx.req),
    );
    const baseUrl = this.config.get('APP_BASE_URL', { infer: true });
    return {
      invitation: Invitation.from(invitation),
      url: `${baseUrl}/register/${token}`,
    };
  }

  /** The links the logged-in account created. */
  @Query(() => [Invitation])
  async myInvitations(@RequireAuth() auth: AuthContext): Promise<Invitation[]> {
    const now = new Date();
    return (await this.invitations.listOwn(auth)).map((row) =>
      Invitation.from(row, now),
    );
  }

  /**
   * What the registration page may show for a link, or null when the link is
   * unknown, expired, used or its inviter can no longer invite (no reason is
   * given, so nobody can probe tokens for details).
   */
  @Public()
  @Query(() => InvitationPreview, { nullable: true })
  async invitation(
    @Args('token') token: string,
  ): Promise<InvitationPreview | null> {
    const row = await this.invitations.findUsable(token);
    if (!row) return null;
    return {
      kind: row.kind,
      recipientEmail: row.recipientEmail,
      recipientPhone: row.recipientPhone,
      locale: row.locale,
      expiresAt: row.expiresAt,
    };
  }
}
