import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Public } from '../auth/public.decorator.js';
import type { AuthContext, GqlContext } from '../auth/auth.types.js';
import { requestMeta } from '../auth/cookies.js';
import { RequireAuth } from '../auth/current-actor.decorator.js';
import { parseId } from '../common/field-schemas.js';
import { appError } from '../common/graphql-error.js';
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
  constructor(private readonly invitations: InvitationsService) {}

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
    const { invitation, url } = await this.invitations.create(
      auth,
      parsed.data,
      requestMeta(ctx.req),
    );
    return { invitation: Invitation.from(invitation), url };
  }

  /** Revokes a link that is still usable (its author or a SuperAdministrator). */
  @Mutation(() => Invitation)
  async revokeInvitation(
    @Args('id', { type: () => ID }) id: string,
    @RequireAuth() auth: AuthContext,
    @Context() ctx: GqlContext,
  ): Promise<Invitation> {
    const row = await this.invitations.revoke(
      auth,
      parseId(id),
      requestMeta(ctx.req),
    );
    return Invitation.from(row);
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
