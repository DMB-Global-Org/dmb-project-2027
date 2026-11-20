import type { Role } from '../db/schema/enums.js';
import { isAccessRole, isAtLeast, roleLevel } from './roles.js';
import type {
  Actor,
  Decision,
  DenyReason,
  InviteRecommenderFacts,
  Request,
  TargetFacts,
} from './types.js';

const ALLOW: Decision = { allowed: true };
const deny = (reason: DenyReason): Decision => ({ allowed: false, reason });

/**
 * The permission engine: a pure function from "who" and "what" to a decision.
 * Every resolver asks it; nothing else decides who may do what. The matrix it
 * encodes is the table "Uprawnienia według ról" in docs/specyfikacja.md and
 * each cell of that table has a test in can.spec.ts.
 *
 * Scope by role (the table's "in own organization" / "in own downline"):
 * - ordinary roles (GENERAL to SILVER): no administrative actions; they only
 *   invite and change sponsors inside their own downline;
 * - PLATINUM: everything inside their own organization;
 * - ADMINISTRATOR: everything inside their own downline;
 * - SUPER_ADMINISTRATOR: everywhere.
 */
export function can(actor: Actor, request: Request): Decision {
  if (request.action === 'UPDATE_OWN_PROFILE') {
    // The owner completes the profile while the account awaits activation.
    return actor.state === 'PENDING_ACTIVATION' || actor.state === 'ACTIVE'
      ? ALLOW
      : deny('actor_not_active');
  }

  // Every other action is operational and needs an activated account.
  if (actor.state !== 'ACTIVE') return deny('actor_not_active');

  switch (request.action) {
    case 'INVITE':
      return canInvite(actor, request.recommender);
    case 'INVITE_PLATINUM':
      return isSuperAdmin(actor) ? ALLOW : deny('insufficient_role');
    case 'ACTIVATE':
      return canSetActivation(actor, request.target, 'activate');
    case 'DEACTIVATE':
      return canSetActivation(actor, request.target, 'deactivate');
    case 'CHANGE_STATUS':
      return canChangeStatus(actor, request.target);
    case 'CHANGE_ROLE':
      return canChangeRole(actor, request.target, request.newRole);
    case 'PROMOTE':
      return canPromote(actor, request.target);
    case 'CHANGE_RECOMMENDER':
      return canChangeRecommender(actor, request);
    case 'REMOVE_FROM_STRUCTURE':
      return canRemove(actor, request.target);
    case 'SEND_ORG_MAILING':
      return isAtLeast(actor.role, 'PLATINUM')
        ? ALLOW
        : deny('insufficient_role');
    case 'VIEW_AUDIT':
      return canViewAudit(actor, request.target);
    case 'VIEW_STRUCTURE':
      // Everybody who may operate sees the structure below them; what is
      // visible is decided by the query (downline), not by the role.
      return ALLOW;
    case 'UPDATE_ACCOUNT':
      return canUpdateAccount(actor, request.target);
    case 'CHANGE_PARTNER_NUMBER':
      return canChangePartnerNumber(actor, request.target);
    case 'REVOKE_INVITATION':
      return request.isInviter || isSuperAdmin(actor)
        ? ALLOW
        : deny('not_in_scope');
  }
}

function isSuperAdmin(actor: Actor): boolean {
  return actor.role === 'SUPER_ADMINISTRATOR';
}

/** Is the target inside the actor's administrative scope? (Self is handled by callers.) */
function inAdminScope(actor: Actor, target: TargetFacts): boolean {
  switch (actor.role) {
    case 'SUPER_ADMINISTRATOR':
      return true;
    case 'ADMINISTRATOR':
      return target.actorIsAncestor;
    case 'PLATINUM':
      return target.sameOrg;
    default:
      return false;
  }
}

function scopeDenial(actor: Actor): Decision {
  return deny(
    isAtLeast(actor.role, 'PLATINUM') ? 'not_in_scope' : 'insufficient_role',
  );
}

/** Checks shared by every administrative action on one account. */
function commonTargetChecks(target: TargetFacts): Decision | null {
  if (target.isSelf) return deny('self');
  if (target.removed) return deny('target_removed');
  return null;
}

function canInvite(
  actor: Actor,
  recommender: InviteRecommenderFacts,
): Decision {
  if (recommender.removed) return deny('recommender_removed');
  // A sponsor other than the inviter must be able to operate (decision 73).
  if (recommender.state !== 'ACTIVE') return deny('recommender_not_active');
  if (isSuperAdmin(actor)) return ALLOW;
  return recommender.actorIsAncestorOrSelf ? ALLOW : deny('not_in_scope');
}

function canSetActivation(
  actor: Actor,
  target: TargetFacts,
  change: 'activate' | 'deactivate',
): Decision {
  const common = commonTargetChecks(target);
  if (common) return common;

  if (target.isOrgRoot) {
    // The root of an organization cannot be managed from inside it: only
    // SuperAdministrators and Administrators above the organization.
    const allowed =
      isSuperAdmin(actor) ||
      (actor.role === 'ADMINISTRATOR' && target.actorIsAboveOrg);
    if (!allowed) return scopeDenial(actor);
  } else if (!inAdminScope(actor, target)) {
    return scopeDenial(actor);
  }

  const validState =
    change === 'activate'
      ? target.state !== 'ACTIVE'
      : target.state !== 'DEACTIVATED';
  return validState ? ALLOW : deny('invalid_state');
}

/** Name and phone of somebody else's account (decision 85). */
function canUpdateAccount(actor: Actor, target: TargetFacts): Decision {
  const common = commonTargetChecks(target);
  if (common) return common;
  if (target.isOrgRoot) {
    // Like activation: the root is managed from above the organization.
    const allowed =
      isSuperAdmin(actor) ||
      (actor.role === 'ADMINISTRATOR' && target.actorIsAboveOrg);
    return allowed ? ALLOW : scopeDenial(actor);
  }
  return inAdminScope(actor, target) ? ALLOW : scopeDenial(actor);
}

/** The Partner number is unique and stays reserved: only a SuperAdministrator edits it. */
function canChangePartnerNumber(actor: Actor, target: TargetFacts): Decision {
  const common = commonTargetChecks(target);
  if (common) return common;
  return isSuperAdmin(actor) ? ALLOW : deny('insufficient_role');
}

function canChangeStatus(actor: Actor, target: TargetFacts): Decision {
  const common = commonTargetChecks(target);
  if (common) return common;

  if (target.isOrgRoot) {
    // Status of a Platinum: Platinum or Administrator above the organization,
    // or SuperAdministrator (they see the account, not the organization).
    const allowed =
      isSuperAdmin(actor) ||
      (isAtLeast(actor.role, 'PLATINUM') && target.actorIsAboveOrg);
    return allowed ? ALLOW : scopeDenial(actor);
  }
  return inAdminScope(actor, target) ? ALLOW : scopeDenial(actor);
}

function canChangeRole(
  actor: Actor,
  target: TargetFacts,
  newRole: Role,
): Decision {
  const common = commonTargetChecks(target);
  if (common) return common;

  if (newRole === 'SUPER_ADMINISTRATOR') return deny('role_not_assignable');
  // Becoming Platinum detaches an organization: only through PROMOTE.
  if (newRole === 'PLATINUM' && !target.isOrgRoot) return deny('use_promote');

  if (target.isOrgRoot || target.role === 'PLATINUM') {
    // Platinums are never demoted (decision 64); only a SuperAdministrator
    // may raise one to Administrator.
    if (!isSuperAdmin(actor)) return scopeDenial(actor);
    const raising =
      (newRole === 'PLATINUM' || newRole === 'ADMINISTRATOR') &&
      roleLevel(newRole) >= roleLevel(target.role);
    return raising ? ALLOW : deny('root_locked');
  }

  // Only a SuperAdministrator grants or revokes Administrator (decision 81).
  if (newRole === 'ADMINISTRATOR' || target.role === 'ADMINISTRATOR') {
    return isSuperAdmin(actor) ? ALLOW : deny('role_not_assignable');
  }

  if (!isAccessRole(newRole)) return deny('role_not_assignable');
  return inAdminScope(actor, target) ? ALLOW : scopeDenial(actor);
}

function canPromote(actor: Actor, target: TargetFacts): Decision {
  const common = commonTargetChecks(target);
  if (common) return common;
  if (target.isOrgRoot || target.role === 'PLATINUM') {
    return deny('already_platinum');
  }
  if (!inAdminScope(actor, target)) return scopeDenial(actor);
  // Only an activated person with an access role can head a new organization.
  if (target.state !== 'ACTIVE' || !isAccessRole(target.role)) {
    return deny('invalid_state');
  }
  return ALLOW;
}

function canRemove(actor: Actor, target: TargetFacts): Decision {
  const common = commonTargetChecks(target);
  if (common) return common;
  // The root of an organization cannot be removed from it.
  if (target.isOrgRoot) return deny('root_locked');
  return inAdminScope(actor, target) ? ALLOW : scopeDenial(actor);
}

function canChangeRecommender(
  actor: Actor,
  request: Extract<Request, { action: 'CHANGE_RECOMMENDER' }>,
): Decision {
  const { target, newRecommender } = request;
  const common = commonTargetChecks(target);
  if (common) return common;
  // Organization roots are not moved: their sponsor lives outside the organization.
  if (target.isOrgRoot) return deny('root_locked');

  // Any partner may rearrange their own downline, whatever their role
  // (decision 71): they must stand above the moved person and above or at
  // the new sponsor. SuperAdministrators are not bound by the sponsor chain.
  if (!isSuperAdmin(actor)) {
    if (!target.actorIsAncestor) return deny('not_in_scope');
    if (!newRecommender.actorIsAncestorOrSelf) return deny('not_in_scope');
  }

  if (!newRecommender.sameOrgAsTarget) return deny('other_org');
  if (newRecommender.removed) return deny('recommender_removed');
  if (newRecommender.isTargetOrInTargetSubtree) return deny('cycle');
  return ALLOW;
}

function canViewAudit(actor: Actor, target: TargetFacts): Decision {
  switch (actor.role) {
    case 'SUPER_ADMINISTRATOR':
      return ALLOW;
    case 'ADMINISTRATOR':
      return target.actorIsAncestor ? ALLOW : deny('not_in_scope');
    case 'PLATINUM':
      return target.sameOrg ? ALLOW : deny('not_in_scope');
    default:
      return deny('insufficient_role');
  }
}
