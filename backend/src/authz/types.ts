import type { AccountState, Role } from '../db/schema/enums.js';

/**
 * Who is acting. SuperAdministrators have no row in an organization schema;
 * they are represented by `role: 'SUPER_ADMINISTRATOR'`.
 */
export interface Actor {
  accountId: string;
  role: Role;
  state: AccountState;
}

/**
 * Facts about the relation between the actor and the account an action is
 * aimed at. The engine never touches the database: a loader computes these
 * facts (recursive queries over the sponsor tree) and passes them in.
 */
export interface TargetFacts {
  role: Role;
  state: AccountState;
  /** Removed from the structure (decision 72); nothing may act on it. */
  removed: boolean;
  isSelf: boolean;
  /** The target lives in the actor's own organization schema. */
  sameOrg: boolean;
  /** The actor is strictly above the target in the sponsor chain of that organization. */
  actorIsAncestor: boolean;
  /** The target is the Platinum at the root of its organization. */
  isOrgRoot: boolean;
  /** For an organization root: the actor stands in the line above that organization. */
  actorIsAboveOrg: boolean;
}

/** The sponsor named in an invitation. */
export interface InviteRecommenderFacts {
  /** The actor is the recommender or stands above them in the same organization. */
  actorIsAncestorOrSelf: boolean;
  state: AccountState;
  removed: boolean;
}

/** The new sponsor in a change of sponsor. */
export interface NewRecommenderFacts extends InviteRecommenderFacts {
  /** The new sponsor lives in the same organization schema as the target. */
  sameOrgAsTarget: boolean;
  /** The new sponsor is the target or somebody in the target's downline. */
  isTargetOrInTargetSubtree: boolean;
}

export type Action =
  | 'INVITE'
  | 'INVITE_PLATINUM'
  | 'ACTIVATE'
  | 'DEACTIVATE'
  | 'CHANGE_ROLE'
  | 'CHANGE_STATUS'
  | 'PROMOTE'
  | 'CHANGE_RECOMMENDER'
  | 'REMOVE_FROM_STRUCTURE'
  | 'SEND_ORG_MAILING'
  | 'VIEW_AUDIT'
  | 'UPDATE_OWN_PROFILE';

export type Request =
  | { action: 'INVITE'; recommender: InviteRecommenderFacts }
  | { action: 'INVITE_PLATINUM' }
  | {
      action:
        | 'ACTIVATE'
        | 'DEACTIVATE'
        | 'CHANGE_STATUS'
        | 'PROMOTE'
        | 'REMOVE_FROM_STRUCTURE'
        | 'VIEW_AUDIT';
      target: TargetFacts;
    }
  | { action: 'CHANGE_ROLE'; target: TargetFacts; newRole: Role }
  | {
      action: 'CHANGE_RECOMMENDER';
      target: TargetFacts;
      newRecommender: NewRecommenderFacts;
    }
  | { action: 'SEND_ORG_MAILING' }
  | { action: 'UPDATE_OWN_PROFILE' };

/** Machine-readable denial reasons; the frontend maps them to texts. */
export type DenyReason =
  | 'actor_not_active'
  | 'insufficient_role'
  | 'not_in_scope'
  | 'self'
  | 'target_removed'
  | 'invalid_state'
  | 'role_not_assignable'
  | 'use_promote'
  | 'already_platinum'
  | 'root_locked'
  | 'other_org'
  | 'cycle'
  | 'recommender_not_active'
  | 'recommender_removed';

export type Decision =
  { allowed: true } | { allowed: false; reason: DenyReason };
