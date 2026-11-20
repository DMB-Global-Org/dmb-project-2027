import { ROLES, type Role } from '../db/schema/enums.js';

const LEVELS: Record<Role, number> = Object.fromEntries(
  ROLES.map((role, index) => [role, index + 1]),
) as Record<Role, number>;

/** Position in the linear role hierarchy (GENERAL = 1 ... SUPER_ADMINISTRATOR = 7). */
export function roleLevel(role: Role): number {
  return LEVELS[role];
}

export function isAtLeast(role: Role, minimum: Role): boolean {
  return roleLevel(role) >= roleLevel(minimum);
}

/** Roles that only grant access to resources; they have no structural effect. */
export const ACCESS_ROLES = [
  'GENERAL',
  'FOUNDATION',
  'BUILDER',
  'SILVER',
] as const satisfies readonly Role[];

export function isAccessRole(role: Role): boolean {
  return (ACCESS_ROLES as readonly Role[]).includes(role);
}
