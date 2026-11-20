import { appSchema } from './app.schema.js';

// Roles are linear: a higher role includes the permissions of the lower ones.
export const ROLES = [
  'GENERAL',
  'FOUNDATION',
  'BUILDER',
  'SILVER',
  'PLATINUM',
  'ADMINISTRATOR',
  'SUPER_ADMINISTRATOR',
] as const;
export type Role = (typeof ROLES)[number];
export const roleEnum = appSchema.enum('role', ROLES);

// Informational status maintained by the direct Platinum (independent of role).
export const PARTNER_STATUSES = [
  'INACTIVE',
  'ACTIVE',
  'GO_MAGIC',
  'DIAMOND_SCHOOL',
] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];
export const partnerStatusEnum = appSchema.enum(
  'partner_status',
  PARTNER_STATUSES,
);

// Account lifecycle; separate from PartnerStatus (decisions 65 and 73).
export const ACCOUNT_STATES = [
  'PENDING_ACTIVATION',
  'ACTIVE',
  'DEACTIVATED',
] as const;
export type AccountState = (typeof ACCOUNT_STATES)[number];
export const accountStateEnum = appSchema.enum('account_state', ACCOUNT_STATES);

// What an invitation creates: an ordinary Partner inside an existing
// organization, or the Platinum at the root of a brand-new one (decision 68).
export const INVITATION_KINDS = ['PARTNER', 'PLATINUM'] as const;
export type InvitationKind = (typeof INVITATION_KINDS)[number];
export const invitationKindEnum = appSchema.enum(
  'invitation_kind',
  INVITATION_KINDS,
);

// Delivery state of an outgoing message in the outbox.
export const NOTIFICATION_STATUSES = ['PENDING', 'SENT', 'FAILED'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];
export const notificationStatusEnum = appSchema.enum(
  'notification_status',
  NOTIFICATION_STATUSES,
);
