import {
  Field,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import type { InvitationRow } from '../db/schema/index.js';
import {
  invitationStatus,
  type InvitationStatus,
} from './invitations.service.js';

export const InvitationKindEnum = {
  PARTNER: 'PARTNER',
  PLATINUM: 'PLATINUM',
} as const;
registerEnumType(InvitationKindEnum, { name: 'InvitationKind' });

export const InvitationStatusEnum = {
  PENDING: 'PENDING',
  USED: 'USED',
  EXPIRED: 'EXPIRED',
} as const;
registerEnumType(InvitationStatusEnum, { name: 'InvitationStatus' });

@ObjectType()
export class Invitation {
  @Field(() => ID)
  id!: string;

  @Field(() => InvitationKindEnum)
  kind!: keyof typeof InvitationKindEnum;

  @Field(() => String, { nullable: true })
  recipientEmail!: string | null;

  @Field(() => String, { nullable: true })
  recipientPhone!: string | null;

  @Field()
  locale!: string;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  expiresAt!: Date;

  @Field(() => InvitationStatusEnum)
  status!: InvitationStatus;

  static from(row: InvitationRow, now = new Date()): Invitation {
    const invitation = new Invitation();
    invitation.id = row.id;
    invitation.kind = row.kind;
    invitation.recipientEmail = row.recipientEmail;
    invitation.recipientPhone = row.recipientPhone;
    invitation.locale = row.locale;
    invitation.createdAt = row.createdAt;
    invitation.expiresAt = row.expiresAt;
    invitation.status = invitationStatus(row, now);
    return invitation;
  }
}

/** Returned once, when the link is created: the token is not stored. */
@ObjectType()
export class CreatedInvitation {
  @Field(() => Invitation)
  invitation!: Invitation;

  @Field()
  url!: string;
}

/** What the registration page may know about a link (no inviter details). */
@ObjectType()
export class InvitationPreview {
  @Field(() => InvitationKindEnum)
  kind!: keyof typeof InvitationKindEnum;

  @Field(() => String, { nullable: true })
  recipientEmail!: string | null;

  @Field(() => String, { nullable: true })
  recipientPhone!: string | null;

  @Field()
  locale!: string;

  @Field(() => Date)
  expiresAt!: Date;
}

@InputType()
export class CreateInvitationInput {
  @Field(() => InvitationKindEnum)
  kind!: keyof typeof InvitationKindEnum;

  /** PARTNER only: the sponsor; defaults to the inviter. */
  @Field(() => ID, { nullable: true })
  recommenderId?: string;

  @Field(() => String, { nullable: true })
  recipientEmail?: string;

  @Field(() => String, { nullable: true })
  recipientPhone?: string;

  @Field(() => String, { nullable: true })
  locale?: string;
}

@InputType()
export class RegisterInput {
  @Field()
  token!: string;

  @Field()
  email!: string;

  @Field()
  password!: string;

  @Field()
  passwordConfirmation!: string;

  @Field(() => String, { nullable: true })
  country?: string;

  @Field()
  partnerNumber!: string;
}
