import { ROLES, type Role } from '../db/schema/enums.js';
import { can } from './can.js';
import { isAccessRole } from './roles.js';
import type {
  Action,
  Actor,
  Decision,
  InviteRecommenderFacts,
  NewRecommenderFacts,
  Request,
  TargetFacts,
} from './types.js';

// ---------------------------------------------------------------- fixtures

const actorOf = (role: Role, state: Actor['state'] = 'ACTIVE'): Actor => ({
  accountId: 'actor',
  role,
  state,
});

/** An ordinary, active, non-root member that is NOT in the actor's scope. */
const outsideTarget = (over: Partial<TargetFacts> = {}): TargetFacts => ({
  role: 'GENERAL',
  state: 'ACTIVE',
  removed: false,
  isSelf: false,
  sameOrg: false,
  actorIsAncestor: false,
  isOrgRoot: false,
  actorIsAboveOrg: false,
  ...over,
});

/** A member of the actor's own downline (and therefore of their organization). */
const downlineTarget = (over: Partial<TargetFacts> = {}): TargetFacts =>
  outsideTarget({ sameOrg: true, actorIsAncestor: true, ...over });

/** The Platinum at the root of another organization, below the actor's line. */
const rootBelow = (over: Partial<TargetFacts> = {}): TargetFacts =>
  outsideTarget({
    role: 'PLATINUM',
    isOrgRoot: true,
    actorIsAboveOrg: true,
    ...over,
  });

const inviteRecommender = (
  over: Partial<InviteRecommenderFacts> = {},
): InviteRecommenderFacts => ({
  actorIsAncestorOrSelf: true,
  state: 'ACTIVE',
  removed: false,
  ...over,
});

const newRecommender = (
  over: Partial<NewRecommenderFacts> = {},
): NewRecommenderFacts => ({
  ...inviteRecommender(),
  sameOrgAsTarget: true,
  isTargetOrInTargetSubtree: false,
  ...over,
});

const ok = (decision: Decision) => decision.allowed;
const reasonOf = (decision: Decision) =>
  decision.allowed ? undefined : decision.reason;

const LOW_ROLES = ROLES.filter(isAccessRole);

// ------------------------------------------------- the matrix of the spec
//
// "Uprawnienia według ról" in docs/specyfikacja.md, one entry per cell.
//   none     = "nie"
//   downline = "tak, w swojej dolnej linii"
//   org      = "tak, we własnej organizacji"
//   any      = "tak"

type Scope = 'none' | 'downline' | 'org' | 'any';
type Column =
  | 'creates'
  | 'activates'
  | 'changesRoles'
  | 'changesStatuses'
  | 'promotes'
  | 'changesRecommender';

type Row = Record<Column, Scope>;

const MATRIX: Record<
  'ordinary' | 'PLATINUM' | 'ADMINISTRATOR' | 'SUPER_ADMINISTRATOR',
  Row
> = {
  // Ogólne, Foundation, Builder, Silver
  ordinary: {
    creates: 'downline',
    activates: 'none',
    changesRoles: 'none',
    changesStatuses: 'none',
    promotes: 'none',
    changesRecommender: 'downline',
  },
  PLATINUM: {
    creates: 'org',
    activates: 'org',
    changesRoles: 'org',
    changesStatuses: 'org',
    promotes: 'org',
    changesRecommender: 'org',
  },
  ADMINISTRATOR: {
    creates: 'downline',
    activates: 'downline',
    changesRoles: 'downline',
    changesStatuses: 'downline',
    promotes: 'downline',
    changesRecommender: 'downline',
  },
  SUPER_ADMINISTRATOR: {
    creates: 'any',
    activates: 'any',
    changesRoles: 'any',
    changesStatuses: 'any',
    promotes: 'any',
    changesRecommender: 'any',
  },
};

/** Request for a target that is inside (`in`) or outside (`out`) the scope. */
type Case = (position: 'in' | 'out', actor: Actor) => Request;

// For a Platinum "outside" means another organization; for the others it means
// another branch. Facts for "inside" are what the loader would produce.
const target = (position: 'in' | 'out', over: Partial<TargetFacts> = {}) =>
  position === 'in' ? downlineTarget(over) : outsideTarget(over);

const CASES: Record<Column, Case[]> = {
  creates: [
    (p) => ({
      action: 'INVITE',
      recommender: inviteRecommender({ actorIsAncestorOrSelf: p === 'in' }),
    }),
  ],
  activates: [
    (p) => ({
      action: 'ACTIVATE',
      target: target(p, { state: 'PENDING_ACTIVATION' }),
    }),
    (p) => ({ action: 'DEACTIVATE', target: target(p) }),
  ],
  changesRoles: [
    (p) => ({ action: 'CHANGE_ROLE', target: target(p), newRole: 'SILVER' }),
  ],
  changesStatuses: [(p) => ({ action: 'CHANGE_STATUS', target: target(p) })],
  promotes: [(p) => ({ action: 'PROMOTE', target: target(p) })],
  changesRecommender: [
    // Both the moved person and the new sponsor must be in scope.
    (p) => ({
      action: 'CHANGE_RECOMMENDER',
      target: target(p),
      newRecommender: newRecommender({ actorIsAncestorOrSelf: true }),
    }),
    (p) => ({
      action: 'CHANGE_RECOMMENDER',
      target: target('in'),
      newRecommender: newRecommender({ actorIsAncestorOrSelf: p === 'in' }),
    }),
  ],
};

const matrixRows: [string, Actor, Row][] = [
  ...LOW_ROLES.map((role): [string, Actor, Row] => [
    role,
    actorOf(role),
    MATRIX.ordinary,
  ]),
  ['PLATINUM', actorOf('PLATINUM'), MATRIX.PLATINUM],
  ['ADMINISTRATOR', actorOf('ADMINISTRATOR'), MATRIX.ADMINISTRATOR],
  [
    'SUPER_ADMINISTRATOR',
    actorOf('SUPER_ADMINISTRATOR'),
    MATRIX.SUPER_ADMINISTRATOR,
  ],
];

describe('permission matrix (docs/specyfikacja.md, "Uprawnienia według ról")', () => {
  describe.each(matrixRows)('role %s', (_name, actor, row) => {
    for (const column of Object.keys(row) as Column[]) {
      const scope = row[column];

      it(`${column}: ${scope}`, () => {
        for (const build of CASES[column]) {
          const inside = ok(can(actor, build('in', actor)));
          const outside = ok(can(actor, build('out', actor)));

          if (scope === 'none') {
            expect(inside).toBe(false);
            expect(outside).toBe(false);
          } else if (scope === 'any') {
            expect(inside).toBe(true);
            expect(outside).toBe(true);
          } else {
            // 'downline' and 'org': inside yes, outside no.
            expect(inside).toBe(true);
            expect(outside).toBe(false);
          }
        }
      });
    }
  });

  it('covers every role and every column of the matrix', () => {
    expect(matrixRows.map(([name]) => name)).toEqual([
      ...LOW_ROLES,
      'PLATINUM',
      'ADMINISTRATOR',
      'SUPER_ADMINISTRATOR',
    ]);
    for (const [, , row] of matrixRows) {
      expect(Object.keys(row).sort()).toEqual(Object.keys(CASES).sort());
    }
  });
});

// ------------------------------------------------------- actor preconditions

describe('actor state', () => {
  const allActions: Request[] = [
    { action: 'INVITE', recommender: inviteRecommender() },
    { action: 'INVITE_PLATINUM' },
    {
      action: 'ACTIVATE',
      target: downlineTarget({ state: 'PENDING_ACTIVATION' }),
    },
    { action: 'DEACTIVATE', target: downlineTarget() },
    { action: 'CHANGE_ROLE', target: downlineTarget(), newRole: 'SILVER' },
    { action: 'CHANGE_STATUS', target: downlineTarget() },
    { action: 'PROMOTE', target: downlineTarget() },
    {
      action: 'CHANGE_RECOMMENDER',
      target: downlineTarget(),
      newRecommender: newRecommender(),
    },
    { action: 'REMOVE_FROM_STRUCTURE', target: downlineTarget() },
    { action: 'SEND_ORG_MAILING' },
    { action: 'VIEW_AUDIT', target: downlineTarget() },
    { action: 'VIEW_STRUCTURE' },
    { action: 'UPDATE_ACCOUNT', target: downlineTarget() },
    { action: 'CHANGE_PARTNER_NUMBER', target: downlineTarget() },
    { action: 'REVOKE_INVITATION', isInviter: true },
  ];

  it.each(allActions)(
    'an account awaiting activation cannot do $action',
    (request) => {
      const decision = can(
        actorOf('SUPER_ADMINISTRATOR', 'PENDING_ACTIVATION'),
        request,
      );
      expect(reasonOf(decision)).toBe('actor_not_active');
    },
  );

  it.each(allActions)('a deactivated account cannot do $action', (request) => {
    const decision = can(
      actorOf('SUPER_ADMINISTRATOR', 'DEACTIVATED'),
      request,
    );
    expect(reasonOf(decision)).toBe('actor_not_active');
  });

  it.each(['PENDING_ACTIVATION', 'ACTIVE'] as const)(
    'an account in state %s may update its own profile',
    (state) => {
      expect(
        ok(can(actorOf('GENERAL', state), { action: 'UPDATE_OWN_PROFILE' })),
      ).toBe(true);
    },
  );

  it('a deactivated account may not update its profile', () => {
    expect(
      reasonOf(
        can(actorOf('GENERAL', 'DEACTIVATED'), {
          action: 'UPDATE_OWN_PROFILE',
        }),
      ),
    ).toBe('actor_not_active');
  });
});

// ------------------------------------------------------ rules beyond the grid

describe('nobody acts on themselves', () => {
  const self = downlineTarget({ isSelf: true });
  const actions: Request[] = [
    { action: 'ACTIVATE', target: { ...self, state: 'PENDING_ACTIVATION' } },
    { action: 'DEACTIVATE', target: self },
    { action: 'CHANGE_ROLE', target: self, newRole: 'SILVER' },
    { action: 'CHANGE_STATUS', target: self },
    { action: 'PROMOTE', target: self },
    { action: 'REMOVE_FROM_STRUCTURE', target: self },
    // Own data goes through UPDATE_OWN_PROFILE.
    { action: 'UPDATE_ACCOUNT', target: self },
    { action: 'CHANGE_PARTNER_NUMBER', target: self },
    {
      action: 'CHANGE_RECOMMENDER',
      target: self,
      newRecommender: newRecommender(),
    },
  ];

  it.each(['PLATINUM', 'ADMINISTRATOR', 'SUPER_ADMINISTRATOR'] as const)(
    '%s cannot change their own role, status, activation or place',
    (role) => {
      for (const request of actions) {
        expect(reasonOf(can(actorOf(role), request))).toBe('self');
      }
    },
  );
});

describe('removed accounts', () => {
  it.each([
    'ACTIVATE',
    'DEACTIVATE',
    'CHANGE_STATUS',
    'PROMOTE',
    'REMOVE_FROM_STRUCTURE',
  ] as const)('nobody can %s a removed account', (action) => {
    const request = {
      action,
      target: downlineTarget({ removed: true }),
    } as Request;
    expect(reasonOf(can(actorOf('SUPER_ADMINISTRATOR'), request))).toBe(
      'target_removed',
    );
  });

  it('a removed account cannot be a sponsor, new or in an invitation', () => {
    expect(
      reasonOf(
        can(actorOf('SUPER_ADMINISTRATOR'), {
          action: 'CHANGE_RECOMMENDER',
          target: downlineTarget(),
          newRecommender: newRecommender({ removed: true }),
        }),
      ),
    ).toBe('recommender_removed');
    expect(
      reasonOf(
        can(actorOf('PLATINUM'), {
          action: 'INVITE',
          recommender: inviteRecommender({ removed: true }),
        }),
      ),
    ).toBe('recommender_removed');
  });
});

describe('roles (decisions 64, 70 and 81)', () => {
  const change = (
    actor: Actor,
    newRole: Role,
    t: TargetFacts = downlineTarget(),
  ) => can(actor, { action: 'CHANGE_ROLE', target: t, newRole });

  it.each(['PLATINUM', 'ADMINISTRATOR', 'SUPER_ADMINISTRATOR'] as const)(
    '%s may switch a member between the access roles',
    (role) => {
      for (const newRole of LOW_ROLES) {
        expect(ok(change(actorOf(role), newRole))).toBe(true);
      }
    },
  );

  it.each(['PLATINUM', 'ADMINISTRATOR'] as const)(
    '%s cannot grant Administrator or SuperAdministrator',
    (role) => {
      expect(reasonOf(change(actorOf(role), 'ADMINISTRATOR'))).toBe(
        'role_not_assignable',
      );
      expect(reasonOf(change(actorOf(role), 'SUPER_ADMINISTRATOR'))).toBe(
        'role_not_assignable',
      );
    },
  );

  it('only a SuperAdministrator grants Administrator', () => {
    expect(ok(change(actorOf('SUPER_ADMINISTRATOR'), 'ADMINISTRATOR'))).toBe(
      true,
    );
  });

  it('nobody, not even a SuperAdministrator, assigns SuperAdministrator', () => {
    expect(
      reasonOf(change(actorOf('SUPER_ADMINISTRATOR'), 'SUPER_ADMINISTRATOR')),
    ).toBe('role_not_assignable');
  });

  it.each(['PLATINUM', 'ADMINISTRATOR'] as const)(
    '%s cannot change the role of an Administrator',
    (role) => {
      const administrator = downlineTarget({ role: 'ADMINISTRATOR' });
      expect(reasonOf(change(actorOf(role), 'SILVER', administrator))).toBe(
        'role_not_assignable',
      );
    },
  );

  it('a SuperAdministrator may revoke Administrator', () => {
    const administrator = downlineTarget({ role: 'ADMINISTRATOR' });
    expect(
      ok(change(actorOf('SUPER_ADMINISTRATOR'), 'SILVER', administrator)),
    ).toBe(true);
  });

  it('Platinum is reached only through PROMOTE', () => {
    for (const role of [
      'PLATINUM',
      'ADMINISTRATOR',
      'SUPER_ADMINISTRATOR',
    ] as const) {
      expect(reasonOf(change(actorOf(role), 'PLATINUM'))).toBe('use_promote');
    }
  });

  describe('the role of a Platinum (the root of an organization)', () => {
    it.each(['PLATINUM', 'ADMINISTRATOR'] as const)(
      'cannot be changed by %s above the organization',
      (role) => {
        for (const newRole of ROLES) {
          expect(ok(change(actorOf(role), newRole, rootBelow()))).toBe(false);
        }
      },
    );

    it('is never lowered, even by a SuperAdministrator', () => {
      const actor = actorOf('SUPER_ADMINISTRATOR');
      for (const newRole of [...LOW_ROLES, 'SUPER_ADMINISTRATOR'] as const) {
        expect(ok(change(actor, newRole, rootBelow()))).toBe(false);
      }
      expect(reasonOf(change(actor, 'SILVER', rootBelow()))).toBe(
        'root_locked',
      );
    });

    it('may be raised to Administrator by a SuperAdministrator only', () => {
      expect(
        ok(
          change(actorOf('SUPER_ADMINISTRATOR'), 'ADMINISTRATOR', rootBelow()),
        ),
      ).toBe(true);
    });
  });
});

describe('promotion to Platinum', () => {
  const promote = (actor: Actor, t: TargetFacts) =>
    can(actor, { action: 'PROMOTE', target: t });

  it('needs an activated target', () => {
    for (const state of ['PENDING_ACTIVATION', 'DEACTIVATED'] as const) {
      expect(
        reasonOf(promote(actorOf('PLATINUM'), downlineTarget({ state }))),
      ).toBe('invalid_state');
    }
  });

  it('works for every access role of the target', () => {
    for (const role of LOW_ROLES) {
      expect(ok(promote(actorOf('PLATINUM'), downlineTarget({ role })))).toBe(
        true,
      );
    }
  });

  it('is refused for an Administrator target (it would lower the role)', () => {
    expect(
      reasonOf(
        promote(
          actorOf('SUPER_ADMINISTRATOR'),
          downlineTarget({ role: 'ADMINISTRATOR' }),
        ),
      ),
    ).toBe('invalid_state');
  });

  it('is refused for someone who already is a Platinum', () => {
    expect(reasonOf(promote(actorOf('SUPER_ADMINISTRATOR'), rootBelow()))).toBe(
      'already_platinum',
    );
  });
});

describe('activation and status of a Platinum', () => {
  const activate = (actor: Actor, t: TargetFacts) =>
    can(actor, { action: 'ACTIVATE', target: t });
  const setStatus = (actor: Actor, t: TargetFacts) =>
    can(actor, { action: 'CHANGE_STATUS', target: t });
  const pendingRoot = rootBelow({ state: 'PENDING_ACTIVATION' });

  it('is activated by a SuperAdministrator or an Administrator above the organization', () => {
    expect(ok(activate(actorOf('SUPER_ADMINISTRATOR'), pendingRoot))).toBe(
      true,
    );
    expect(ok(activate(actorOf('ADMINISTRATOR'), pendingRoot))).toBe(true);
  });

  it('is not activated by a Platinum above the organization, nor by an Administrator elsewhere', () => {
    expect(ok(activate(actorOf('PLATINUM'), pendingRoot))).toBe(false);
    expect(
      ok(
        activate(actorOf('ADMINISTRATOR'), {
          ...pendingRoot,
          actorIsAboveOrg: false,
        }),
      ),
    ).toBe(false);
  });

  it('has its status set by Platinum and Administrator above it, and by a SuperAdministrator', () => {
    for (const role of [
      'PLATINUM',
      'ADMINISTRATOR',
      'SUPER_ADMINISTRATOR',
    ] as const) {
      expect(ok(setStatus(actorOf(role), rootBelow()))).toBe(true);
    }
  });

  it('has its status refused to anyone not above the organization', () => {
    for (const role of ['PLATINUM', 'ADMINISTRATOR'] as const) {
      expect(
        ok(setStatus(actorOf(role), rootBelow({ actorIsAboveOrg: false }))),
      ).toBe(false);
    }
    for (const role of LOW_ROLES) {
      expect(ok(setStatus(actorOf(role), rootBelow()))).toBe(false);
    }
  });
});

describe('activation state machine', () => {
  const act = (
    action: 'ACTIVATE' | 'DEACTIVATE',
    state: TargetFacts['state'],
  ) => can(actorOf('PLATINUM'), { action, target: downlineTarget({ state }) });

  it('activates accounts that are pending or deactivated, not active ones', () => {
    expect(ok(act('ACTIVATE', 'PENDING_ACTIVATION'))).toBe(true);
    expect(ok(act('ACTIVATE', 'DEACTIVATED'))).toBe(true);
    expect(reasonOf(act('ACTIVATE', 'ACTIVE'))).toBe('invalid_state');
  });

  it('deactivates accounts that are pending or active, not deactivated ones', () => {
    expect(ok(act('DEACTIVATE', 'ACTIVE'))).toBe(true);
    expect(ok(act('DEACTIVATE', 'PENDING_ACTIVATION'))).toBe(true);
    expect(reasonOf(act('DEACTIVATE', 'DEACTIVATED'))).toBe('invalid_state');
  });
});

describe('change of sponsor (decision 71)', () => {
  const move = (actor: Actor, t: TargetFacts, rec: NewRecommenderFacts) =>
    can(actor, {
      action: 'CHANGE_RECOMMENDER',
      target: t,
      newRecommender: rec,
    });

  it.each([...LOW_ROLES, 'PLATINUM', 'ADMINISTRATOR'] as const)(
    '%s may rearrange their own downline',
    (role) => {
      expect(ok(move(actorOf(role), downlineTarget(), newRecommender()))).toBe(
        true,
      );
    },
  );

  it('lets the actor name themselves as the new sponsor', () => {
    // actorIsAncestorOrSelf covers "self": the actor is the new sponsor.
    expect(
      ok(
        move(
          actorOf('SILVER'),
          downlineTarget(),
          newRecommender({ actorIsAncestorOrSelf: true }),
        ),
      ),
    ).toBe(true);
  });

  it.each(['PENDING_ACTIVATION', 'DEACTIVATED'] as const)(
    'refuses a new sponsor in state %s (decision 86)',
    (state) => {
      for (const role of [...LOW_ROLES, 'PLATINUM', 'ADMINISTRATOR'] as const) {
        expect(
          reasonOf(
            move(actorOf(role), downlineTarget(), newRecommender({ state })),
          ),
        ).toBe('recommender_not_active');
      }
      expect(
        reasonOf(
          move(
            actorOf('SUPER_ADMINISTRATOR'),
            outsideTarget(),
            newRecommender({ state }),
          ),
        ),
      ).toBe('recommender_not_active');
    },
  );

  it('refuses a cycle: the new sponsor is the person or in their downline', () => {
    expect(
      reasonOf(
        move(
          actorOf('PLATINUM'),
          downlineTarget(),
          newRecommender({ isTargetOrInTargetSubtree: true }),
        ),
      ),
    ).toBe('cycle');
  });

  it('refuses a new sponsor from another organization (rule 6)', () => {
    expect(
      reasonOf(
        move(
          actorOf('PLATINUM'),
          downlineTarget(),
          newRecommender({ sameOrgAsTarget: false }),
        ),
      ),
    ).toBe('other_org');
  });

  it("refuses moving a person who is not in the actor's downline", () => {
    expect(
      reasonOf(move(actorOf('SILVER'), outsideTarget(), newRecommender())),
    ).toBe('not_in_scope');
  });

  it('refuses a new sponsor the actor is not above', () => {
    expect(
      reasonOf(
        move(
          actorOf('SILVER'),
          downlineTarget(),
          newRecommender({ actorIsAncestorOrSelf: false }),
        ),
      ),
    ).toBe('not_in_scope');
  });

  it('never moves the root of an organization', () => {
    for (const role of [
      'PLATINUM',
      'ADMINISTRATOR',
      'SUPER_ADMINISTRATOR',
    ] as const) {
      expect(reasonOf(move(actorOf(role), rootBelow(), newRecommender()))).toBe(
        'root_locked',
      );
    }
  });

  it('does not bind a SuperAdministrator to the sponsor chain, but still forbids cycles and other organizations', () => {
    const superAdmin = actorOf('SUPER_ADMINISTRATOR');
    expect(
      ok(
        move(
          superAdmin,
          outsideTarget(),
          newRecommender({ actorIsAncestorOrSelf: false }),
        ),
      ),
    ).toBe(true);
    expect(
      reasonOf(
        move(
          superAdmin,
          outsideTarget(),
          newRecommender({ isTargetOrInTargetSubtree: true }),
        ),
      ),
    ).toBe('cycle');
    expect(
      reasonOf(
        move(
          superAdmin,
          outsideTarget(),
          newRecommender({ sameOrgAsTarget: false }),
        ),
      ),
    ).toBe('other_org');
  });
});

describe('removal from the structure (decisions 72 and 79)', () => {
  const remove = (actor: Actor, t: TargetFacts) =>
    can(actor, { action: 'REMOVE_FROM_STRUCTURE', target: t });

  it('is for Platinum, Administrator and SuperAdministrator only', () => {
    for (const role of LOW_ROLES) {
      expect(reasonOf(remove(actorOf(role), downlineTarget()))).toBe(
        'insufficient_role',
      );
    }
    for (const role of [
      'PLATINUM',
      'ADMINISTRATOR',
      'SUPER_ADMINISTRATOR',
    ] as const) {
      expect(ok(remove(actorOf(role), downlineTarget()))).toBe(true);
    }
  });

  it('never removes the root of an organization', () => {
    expect(reasonOf(remove(actorOf('SUPER_ADMINISTRATOR'), rootBelow()))).toBe(
      'root_locked',
    );
  });
});

describe('invitations', () => {
  it('only a SuperAdministrator invites a Platinum', () => {
    for (const role of ROLES) {
      expect(ok(can(actorOf(role), { action: 'INVITE_PLATINUM' }))).toBe(
        role === 'SUPER_ADMINISTRATOR',
      );
    }
  });

  it('names as sponsor only someone able to operate (decision 73)', () => {
    for (const state of ['PENDING_ACTIVATION', 'DEACTIVATED'] as const) {
      expect(
        reasonOf(
          can(actorOf('PLATINUM'), {
            action: 'INVITE',
            recommender: inviteRecommender({ state }),
          }),
        ),
      ).toBe('recommender_not_active');
    }
  });
});

describe('mailing and audit log', () => {
  it('organizational mailing is for Platinum and above', () => {
    for (const role of ROLES) {
      expect(ok(can(actorOf(role), { action: 'SEND_ORG_MAILING' }))).toBe(
        role === 'PLATINUM' ||
          role === 'ADMINISTRATOR' ||
          role === 'SUPER_ADMINISTRATOR',
      );
    }
  });

  it('the log is seen without limits by a SuperAdministrator, in their downline by an Administrator and in their structure by a Platinum', () => {
    const view = (role: Role, t: TargetFacts) =>
      ok(can(actorOf(role), { action: 'VIEW_AUDIT', target: t }));

    expect(view('SUPER_ADMINISTRATOR', outsideTarget())).toBe(true);
    expect(view('ADMINISTRATOR', downlineTarget())).toBe(true);
    expect(view('ADMINISTRATOR', outsideTarget({ sameOrg: true }))).toBe(false);
    expect(view('PLATINUM', downlineTarget())).toBe(true);
    expect(view('PLATINUM', outsideTarget())).toBe(false);
    for (const role of LOW_ROLES) {
      expect(view(role, downlineTarget())).toBe(false);
    }
  });
});

describe('account data and structure view (decision 85)', () => {
  const update = (role: Role, t: TargetFacts) =>
    can(actorOf(role), { action: 'UPDATE_ACCOUNT', target: t });

  it('name and phone of another account: Platinum in the organization, Administrator in the downline, SuperAdministrator everywhere', () => {
    expect(ok(update('PLATINUM', downlineTarget()))).toBe(true);
    expect(ok(update('PLATINUM', outsideTarget()))).toBe(false);
    expect(ok(update('ADMINISTRATOR', downlineTarget()))).toBe(true);
    expect(ok(update('ADMINISTRATOR', outsideTarget({ sameOrg: true })))).toBe(
      false,
    );
    expect(ok(update('SUPER_ADMINISTRATOR', outsideTarget()))).toBe(true);
  });

  it.each(LOW_ROLES)('%s cannot edit anybody else', (role) => {
    expect(reasonOf(update(role, downlineTarget()))).toBe('insufficient_role');
  });

  it('a removed account cannot be edited', () => {
    expect(
      reasonOf(update('SUPER_ADMINISTRATOR', outsideTarget({ removed: true }))),
    ).toBe('target_removed');
  });

  it('the root of an organization is edited only from above it', () => {
    expect(ok(update('PLATINUM', rootBelow()))).toBe(false);
    expect(ok(update('ADMINISTRATOR', rootBelow()))).toBe(true);
    expect(
      ok(update('ADMINISTRATOR', rootBelow({ actorIsAboveOrg: false }))),
    ).toBe(false);
    expect(ok(update('SUPER_ADMINISTRATOR', rootBelow()))).toBe(true);
  });

  it('the Partner number is edited only by a SuperAdministrator', () => {
    for (const role of ROLES) {
      expect(
        ok(
          can(actorOf(role), {
            action: 'CHANGE_PARTNER_NUMBER',
            target: downlineTarget(),
          }),
        ),
      ).toBe(role === 'SUPER_ADMINISTRATOR');
    }
  });

  it('every active account may view the structure below it', () => {
    for (const role of ROLES) {
      expect(ok(can(actorOf(role), { action: 'VIEW_STRUCTURE' }))).toBe(true);
    }
  });

  it('an invitation is revoked by its author or a SuperAdministrator', () => {
    const revoke = (role: Role, isInviter: boolean) =>
      can(actorOf(role), { action: 'REVOKE_INVITATION', isInviter });
    for (const role of ROLES) {
      expect(ok(revoke(role, true))).toBe(true);
      expect(ok(revoke(role, false))).toBe(role === 'SUPER_ADMINISTRATOR');
    }
    expect(reasonOf(revoke('ADMINISTRATOR', false))).toBe('not_in_scope');
  });
});

// Adding an action without deciding who may do it must break this test.
describe('completeness', () => {
  it('every action is decided for every role', () => {
    const everything: Record<Action, Request> = {
      INVITE: { action: 'INVITE', recommender: inviteRecommender() },
      INVITE_PLATINUM: { action: 'INVITE_PLATINUM' },
      ACTIVATE: {
        action: 'ACTIVATE',
        target: downlineTarget({ state: 'PENDING_ACTIVATION' }),
      },
      DEACTIVATE: { action: 'DEACTIVATE', target: downlineTarget() },
      CHANGE_ROLE: {
        action: 'CHANGE_ROLE',
        target: downlineTarget(),
        newRole: 'SILVER',
      },
      CHANGE_STATUS: { action: 'CHANGE_STATUS', target: downlineTarget() },
      PROMOTE: { action: 'PROMOTE', target: downlineTarget() },
      CHANGE_RECOMMENDER: {
        action: 'CHANGE_RECOMMENDER',
        target: downlineTarget(),
        newRecommender: newRecommender(),
      },
      REMOVE_FROM_STRUCTURE: {
        action: 'REMOVE_FROM_STRUCTURE',
        target: downlineTarget(),
      },
      SEND_ORG_MAILING: { action: 'SEND_ORG_MAILING' },
      VIEW_AUDIT: { action: 'VIEW_AUDIT', target: downlineTarget() },
      VIEW_STRUCTURE: { action: 'VIEW_STRUCTURE' },
      UPDATE_ACCOUNT: { action: 'UPDATE_ACCOUNT', target: downlineTarget() },
      CHANGE_PARTNER_NUMBER: {
        action: 'CHANGE_PARTNER_NUMBER',
        target: downlineTarget(),
      },
      REVOKE_INVITATION: { action: 'REVOKE_INVITATION', isInviter: true },
      UPDATE_OWN_PROFILE: { action: 'UPDATE_OWN_PROFILE' },
    };

    for (const request of Object.values(everything)) {
      for (const role of ROLES) {
        expect(typeof can(actorOf(role), request).allowed).toBe('boolean');
      }
    }
  });
});
