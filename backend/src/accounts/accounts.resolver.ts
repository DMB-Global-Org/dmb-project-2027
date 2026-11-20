import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { z } from 'zod';
import type { AuthContext, GqlContext } from '../auth/auth.types.js';
import { requestMeta } from '../auth/cookies.js';
import { RequireAuth } from '../auth/current-actor.decorator.js';
import { firstInvalidField, parseId } from '../common/field-schemas.js';
import { appError } from '../common/graphql-error.js';
import type { PartnerStatus, Role } from '../db/schema/index.js';
import {
  AccountNode,
  MyProfile,
  PartnerNumberInput,
  PartnerStatusEnum,
  RecommenderCandidate,
  RoleEnum,
  StructureEntry,
  UpdateAccountDataInput,
  UpdateProfileInput,
} from './account.models.js';
import {
  partnerNumberSchema,
  updateAccountDataSchema,
  updateProfileSchema,
} from './account.schemas.js';
import { AccountsService } from './accounts.service.js';

/** Parses an input with zod; the first bad field goes into the error. */
function parseInput<S extends z.ZodType>(
  schema: S,
  input: unknown,
): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw appError('VALIDATION_FAILED', {
      field: firstInvalidField(parsed.error),
    });
  }
  return parsed.data;
}

@Resolver()
export class AccountsResolver {
  constructor(private readonly accounts: AccountsService) {}

  /** The caller and everybody below them (a SuperAdministrator: everybody), in tree order. */
  @Query(() => [StructureEntry])
  structure(@RequireAuth() auth: AuthContext): Promise<StructureEntry[]> {
    return this.accounts.structure(auth);
  }

  @Query(() => AccountNode, { nullable: true })
  account(
    @Args('id', { type: () => ID }) id: string,
    @RequireAuth() auth: AuthContext,
  ): Promise<AccountNode | null> {
    return this.accounts.view(auth, parseId(id));
  }

  @Query(() => MyProfile, { nullable: true })
  myProfile(@RequireAuth() auth: AuthContext): Promise<MyProfile | null> {
    return this.accounts.myProfile(auth);
  }

  @Mutation(() => AccountNode)
  activateAccount(
    @Args('id', { type: () => ID }) id: string,
    @RequireAuth() auth: AuthContext,
    @Context() ctx: GqlContext,
  ): Promise<AccountNode> {
    return this.accounts.activate(auth, parseId(id), requestMeta(ctx.req));
  }

  @Mutation(() => AccountNode)
  deactivateAccount(
    @Args('id', { type: () => ID }) id: string,
    @RequireAuth() auth: AuthContext,
    @Context() ctx: GqlContext,
  ): Promise<AccountNode> {
    return this.accounts.deactivate(auth, parseId(id), requestMeta(ctx.req));
  }

  @Mutation(() => AccountNode)
  changeAccountRole(
    @Args('id', { type: () => ID }) id: string,
    @Args('role', { type: () => RoleEnum }) role: Role,
    @RequireAuth() auth: AuthContext,
    @Context() ctx: GqlContext,
  ): Promise<AccountNode> {
    return this.accounts.changeRole(
      auth,
      parseId(id),
      role,
      requestMeta(ctx.req),
    );
  }

  @Mutation(() => AccountNode)
  changeAccountStatus(
    @Args('id', { type: () => ID }) id: string,
    @Args('status', { type: () => PartnerStatusEnum }) status: PartnerStatus,
    @RequireAuth() auth: AuthContext,
    @Context() ctx: GqlContext,
  ): Promise<AccountNode> {
    return this.accounts.changeStatus(
      auth,
      parseId(id),
      status,
      requestMeta(ctx.req),
    );
  }

  /** The owner's profile, also while the account awaits activation. */
  @Mutation(() => MyProfile)
  updateMyProfile(
    @Args('input') input: UpdateProfileInput,
    @RequireAuth() auth: AuthContext,
    @Context() ctx: GqlContext,
  ): Promise<MyProfile> {
    return this.accounts.updateOwnProfile(
      auth,
      parseInput(updateProfileSchema, input),
      requestMeta(ctx.req),
    );
  }

  @Mutation(() => AccountNode)
  updateAccountData(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateAccountDataInput,
    @RequireAuth() auth: AuthContext,
    @Context() ctx: GqlContext,
  ): Promise<AccountNode> {
    return this.accounts.updateAccountData(
      auth,
      parseId(id),
      parseInput(updateAccountDataSchema, input),
      requestMeta(ctx.req),
    );
  }

  @Mutation(() => AccountNode)
  updatePartnerNumber(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: PartnerNumberInput,
    @RequireAuth() auth: AuthContext,
    @Context() ctx: GqlContext,
  ): Promise<AccountNode> {
    return this.accounts.updatePartnerNumber(
      auth,
      parseId(id),
      parseInput(partnerNumberSchema, input),
      requestMeta(ctx.req),
    );
  }

  /** Moves a person, with their downline, under another sponsor of the same organization. */
  @Mutation(() => AccountNode)
  changeAccountRecommender(
    @Args('id', { type: () => ID }) id: string,
    @Args('recommenderId', { type: () => ID }) recommenderId: string,
    @RequireAuth() auth: AuthContext,
    @Context() ctx: GqlContext,
  ): Promise<AccountNode> {
    return this.accounts.changeRecommender(
      auth,
      parseId(id),
      parseId(recommenderId),
      requestMeta(ctx.req),
    );
  }

  /** Takes a person out of the structure; their downline moves up to their sponsor. */
  @Mutation(() => Boolean)
  removeAccountFromStructure(
    @Args('id', { type: () => ID }) id: string,
    @RequireAuth() auth: AuthContext,
    @Context() ctx: GqlContext,
  ): Promise<boolean> {
    return this.accounts.removeFromStructure(
      auth,
      parseId(id),
      requestMeta(ctx.req),
    );
  }

  /** Whom the person could be moved under. */
  @Query(() => [RecommenderCandidate])
  recommenderCandidates(
    @Args('id', { type: () => ID }) id: string,
    @RequireAuth() auth: AuthContext,
  ): Promise<RecommenderCandidate[]> {
    return this.accounts.recommenderCandidates(auth, parseId(id));
  }

  /** Promotes a person to Platinum: they and their downline move into their own organization. */
  @Mutation(() => AccountNode)
  promoteAccount(
    @Args('id', { type: () => ID }) id: string,
    @RequireAuth() auth: AuthContext,
    @Context() ctx: GqlContext,
  ): Promise<AccountNode> {
    return this.accounts.promote(auth, parseId(id), requestMeta(ctx.req));
  }
}
