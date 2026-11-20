export const ROLES = [
  "GENERAL",
  "FOUNDATION",
  "BUILDER",
  "SILVER",
  "PLATINUM",
  "ADMINISTRATOR",
  "SUPER_ADMINISTRATOR",
] as const;
export type Role = (typeof ROLES)[number];

export const PARTNER_STATUSES = [
  "INACTIVE",
  "ACTIVE",
  "GO_MAGIC",
  "DIAMOND_SCHOOL",
] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

/** Roles that may send organizational mailings (the permission engine decides on the server). */
export function canSendMailing(role: Role): boolean {
  return role === "PLATINUM" || role === "ADMINISTRATOR" || role === "SUPER_ADMINISTRATOR";
}

export interface Mailing {
  id: string;
  subject: string;
  minRole: Role;
  recipientCount: number;
  createdAt: string;
  pending: number;
  sent: number;
  failed: number;
}

export type AccountState = "PENDING_ACTIVATION" | "ACTIVE" | "DEACTIVATED";

export interface Viewer {
  id: string;
  email: string;
  role: Role;
  state: AccountState;
  locale: string;
}

export interface Account {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  partnerNumber: string | null;
  partnerCountry: string | null;
  role: Role;
  status: PartnerStatus;
  state: AccountState;
  profileCompleted: boolean;
  recommenderId: string | null;
  isOrgRoot: boolean;
  detachedOrg: boolean;
  promotedAt: string | null;
  promotedBy: string | null;
  removed: boolean;
  allowedActions: string[];
  assignableRoles: Role[];
}

export interface RecommenderCandidate {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  depth: number;
}

export interface StructureEntry {
  depth: number;
  account: Account;
}

export interface MyProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  partnerNumber: string | null;
  partnerCountry: string | null;
  state: AccountState;
  profileCompletedAt: string | null;
  consentsAcceptedAt: string | null;
}

export type InvitationKind = "PARTNER" | "PLATINUM";
export type InvitationStatus = "PENDING" | "USED" | "EXPIRED";

export interface Invitation {
  id: string;
  kind: InvitationKind;
  recipientEmail: string | null;
  recipientPhone: string | null;
  locale: string;
  createdAt: string;
  expiresAt: string;
  status: InvitationStatus;
}

export interface InvitationPreview {
  kind: InvitationKind;
  recipientEmail: string | null;
  recipientPhone: string | null;
  locale: string;
  expiresAt: string;
}

/** Display name of an account: the name when known, the e-mail otherwise. */
export function displayName(
  account: Pick<Account, "firstName" | "lastName" | "email">,
): string {
  const name = [account.firstName, account.lastName].filter(Boolean).join(" ");
  return name || account.email;
}
