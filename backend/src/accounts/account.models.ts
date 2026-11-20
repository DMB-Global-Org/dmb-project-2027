import {
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  ACCOUNT_STATES,
  PARTNER_STATUSES,
  ROLES,
  type AccountState,
  type PartnerStatus,
  type Role,
} from '../db/schema/enums.js';

function enumObject<T extends string>(values: readonly T[]): { [K in T]: K } {
  return Object.fromEntries(values.map((v) => [v, v])) as { [K in T]: K };
}

export const RoleEnum = enumObject(ROLES);
registerEnumType(RoleEnum, { name: 'Role' });

export const PartnerStatusEnum = enumObject(PARTNER_STATUSES);
registerEnumType(PartnerStatusEnum, { name: 'PartnerStatus' });

export const AccountStateEnum = enumObject(ACCOUNT_STATES);
registerEnumType(AccountStateEnum, { name: 'AccountState' });

/** Actions the API can already perform on an account; the UI shows buttons for these. */
export const ACCOUNT_ACTIONS = [
  'ACTIVATE',
  'DEACTIVATE',
  'CHANGE_ROLE',
  'CHANGE_STATUS',
  'UPDATE_ACCOUNT',
  'CHANGE_PARTNER_NUMBER',
  'CHANGE_RECOMMENDER',
  'REMOVE_FROM_STRUCTURE',
  'PROMOTE',
] as const;
export type AccountAction = (typeof ACCOUNT_ACTIONS)[number];
export const AccountActionEnum = enumObject(ACCOUNT_ACTIONS);
registerEnumType(AccountActionEnum, { name: 'AccountAction' });

@ObjectType()
export class AccountNode {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true })
  firstName!: string | null;

  @Field(() => String, { nullable: true })
  lastName!: string | null;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field(() => String, { nullable: true })
  partnerNumber!: string | null;

  @Field(() => String, { nullable: true })
  partnerCountry!: string | null;

  @Field(() => RoleEnum)
  role!: Role;

  @Field(() => PartnerStatusEnum)
  status!: PartnerStatus;

  @Field(() => AccountStateEnum)
  state!: AccountState;

  /** The owner gave every required piece of data and accepted the consents. */
  @Field()
  profileCompleted!: boolean;

  @Field(() => ID, { nullable: true })
  recommenderId!: string | null;

  /** The Platinum at the head of its organization. */
  @Field()
  isOrgRoot!: boolean;

  /**
   * The Platinum at the head of an organization detached from the one the
   * caller sees (decision 87): the caller sees only this marker, not the
   * organization below it.
   */
  @Field()
  detachedOrg!: boolean;

  /** When and by whom the organization was detached (only with `detachedOrg`). */
  @Field(() => Date, { nullable: true })
  promotedAt!: Date | null;

  @Field(() => ID, { nullable: true })
  promotedBy!: string | null;

  /** Removed from the structure (only a SuperAdministrator still sees such an account). */
  @Field()
  removed!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  /** What the caller may do with this account (decided by the permission engine). */
  @Field(() => [AccountActionEnum])
  allowedActions!: AccountAction[];

  /** Roles the caller may give this account; empty when none. */
  @Field(() => [RoleEnum])
  assignableRoles!: Role[];
}

/** A person a member may be moved under (see `recommenderCandidates`). */
@ObjectType()
export class RecommenderCandidate {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true })
  firstName!: string | null;

  @Field(() => String, { nullable: true })
  lastName!: string | null;

  /** Depth below the top of what the caller sees (for the indentation of a list). */
  @Field(() => Int)
  depth!: number;
}

/** One line of the structure: the account and its depth below the caller (0 = caller). */
@ObjectType()
export class StructureEntry {
  @Field(() => Int)
  depth!: number;

  @Field(() => AccountNode)
  account!: AccountNode;
}

/** The caller's own data for the profile form. */
@ObjectType()
export class MyProfile {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true })
  firstName!: string | null;

  @Field(() => String, { nullable: true })
  lastName!: string | null;

  @Field(() => String, { nullable: true })
  phone!: string | null;

  @Field(() => String, { nullable: true })
  partnerNumber!: string | null;

  @Field(() => String, { nullable: true })
  partnerCountry!: string | null;

  @Field(() => AccountStateEnum)
  state!: AccountState;

  @Field(() => Date, { nullable: true })
  profileCompletedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  consentsAcceptedAt!: Date | null;
}

@InputType()
export class UpdateProfileInput {
  @Field(() => String, { nullable: true })
  firstName?: string | null;

  @Field(() => String, { nullable: true })
  lastName?: string | null;

  @Field(() => String, { nullable: true })
  phone?: string | null;

  /** Accepts the terms and consents; cannot be withdrawn here. */
  @Field(() => Boolean, { nullable: true })
  acceptConsents?: boolean | null;
}

@InputType()
export class UpdateAccountDataInput {
  @Field(() => String, { nullable: true })
  firstName?: string | null;

  @Field(() => String, { nullable: true })
  lastName?: string | null;

  @Field(() => String, { nullable: true })
  phone?: string | null;
}

@InputType()
export class PartnerNumberInput {
  @Field(() => String, { nullable: true })
  country?: string | null;

  @Field()
  partnerNumber!: string;
}
