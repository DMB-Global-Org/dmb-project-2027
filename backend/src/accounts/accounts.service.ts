import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext, RequestMeta } from '../auth/auth.types.js';
import { SessionService } from '../auth/session.service.js';
import { can } from '../authz/can.js';
import type {
  Actor,
  Decision,
  NewRecommenderFacts,
  TargetFacts,
} from '../authz/types.js';
import { appError } from '../common/graphql-error.js';
import type { Env } from '../config/env.js';
import { DB, type Database } from '../db/database.tokens.js';
import { orgTables } from '../db/org/org-tables.js';
import {
  pgConstraintName,
  pgErrorCode,
  PG_UNIQUE_VIOLATION,
} from '../db/pg-error.js';
import {
  accounts,
  orgSchemas,
  ROLES,
  type PartnerStatus,
  type Role,
} from '../db/schema/index.js';
import { TxRunner, type Tx } from '../db/tx-runner.js';
import { OutboxService } from '../mail/outbox.service.js';
import { PromotionService } from './promotion.service.js';
import {
  RelationLoader,
  type LoadedTarget,
  type PartnerRow,
} from '../structure/relation-loader.js';
import {
  ACCOUNT_ACTIONS,
  type AccountAction,
  type AccountNode,
  type MyProfile,
  type RecommenderCandidate,
  type StructureEntry,
} from './account.models.js';
import type {
  PartnerNumberChange,
  UpdateAccountData,
  UpdateProfile,
} from './account.schemas.js';

function assertAllowed(decision: Decision): void {
  if (!decision.allowed) {
    throw appError('FORBIDDEN', { reason: decision.reason });
  }
}

interface AccountRow {
  partner: PartnerRow;
  email: string;
  partnerNumber: string | null;
  partnerCountry: string | null;
  /** Set on the marker of an organization detached by a promotion (decision 87). */
  detached: { promotedAt: Date; promotedBy: string } | null;
}

/** A new sponsor who passes every check; used to ask `can` whether moving is possible at all. */
const ANY_VALID_RECOMMENDER: NewRecommenderFacts = {
  actorIsAncestorOrSelf: true,
  state: 'ACTIVE',
  removed: false,
  sameOrgAsTarget: true,
  isTargetOrInTargetSubtree: false,
};

const fullName = (first: string | null, last: string | null): string =>
  [first, last].filter(Boolean).join(' ');

@Injectable()
export class AccountsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly tx: TxRunner,
    private readonly relations: RelationLoader,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly sessions: SessionService,
    private readonly promotion: PromotionService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ------------------------------------------------------------- queries

  /**
   * The structure the caller sees: themselves and everybody in their downline,
   * parents before children. A SuperAdministrator sees every organization.
   */
  async structure(auth: AuthContext): Promise<StructureEntry[]> {
    assertAllowed(can(auth.actor, { action: 'VIEW_STRUCTURE' }));

    const roots: { orgSchema: string; rootId: string }[] = [];
    if (auth.actor.role === 'SUPER_ADMINISTRATOR') {
      const registry = await this.db
        .select()
        .from(orgSchemas)
        .orderBy(asc(orgSchemas.createdAt));
      for (const org of registry) {
        if (org.rootAccountId) {
          roots.push({ orgSchema: org.name, rootId: org.rootAccountId });
        }
      }
    } else if (auth.orgSchema) {
      roots.push({ orgSchema: auth.orgSchema, rootId: auth.accountId });
    }

    const entries: StructureEntry[] = [];
    for (const { orgSchema, rootId } of roots) {
      const downline = await this.relations.downline(orgSchema, rootId);
      if (downline.length === 0) continue;
      const rows = await this.rowsOf(
        orgSchema,
        downline.map((entry) => entry.accountId),
      );
      const orgRootId = await this.orgRootId(orgSchema);
      for (const { accountId, depth } of downline) {
        const row = rows.get(accountId);
        if (!row) continue;
        const isSelf = accountId === auth.accountId;
        const superAdmin = auth.actor.role === 'SUPER_ADMINISTRATOR';
        // The marker of a detached organization stands in this tree, but the
        // person is the root of another one: the caller is above that
        // organization, not its member.
        const detached = row.detached !== null;
        const facts: TargetFacts = {
          role: row.partner.role,
          state: row.partner.state,
          removed: row.partner.removedAt !== null,
          isSelf,
          sameOrg: !superAdmin && !detached,
          // Everybody in the downline is below the caller by construction.
          actorIsAncestor: !superAdmin && !isSelf && !detached,
          isOrgRoot: detached || accountId === orgRootId,
          actorIsAboveOrg: detached,
        };
        entries.push({ depth, account: this.describe(auth.actor, facts, row) });
      }
    }
    return entries;
  }

  /** One account, or null when it does not exist or the caller may not see it. */
  async view(
    auth: AuthContext,
    accountId: string,
  ): Promise<AccountNode | null> {
    assertAllowed(can(auth.actor, { action: 'VIEW_STRUCTURE' }));
    const loaded = await this.relations.targetFacts(auth, accountId);
    if (!loaded || !this.visible(auth, loaded)) return null;
    const row = await this.rowOf(loaded.orgSchema, accountId);
    if (!row) return null;
    // Seen from above, the head of a detached organization is a marker.
    if (loaded.facts.actorIsAboveOrg) {
      row.detached = await this.promotionOf(loaded.orgSchema);
    }
    return this.describe(auth.actor, loaded.facts, row);
  }

  async myProfile(auth: AuthContext): Promise<MyProfile | null> {
    if (!auth.orgSchema) return null;
    const row = await this.rowOf(auth.orgSchema, auth.accountId);
    if (!row) return null;
    return {
      id: auth.accountId,
      email: row.email,
      firstName: row.partner.firstName,
      lastName: row.partner.lastName,
      phone: row.partner.phone,
      partnerNumber: row.partnerNumber,
      partnerCountry: row.partnerCountry,
      state: row.partner.state,
      profileCompletedAt: row.partner.profileCompletedAt,
      consentsAcceptedAt: row.partner.consentsAcceptedAt,
    };
  }

  // ----------------------------------------------------------- mutations

  activate(auth: AuthContext, id: string, meta: RequestMeta) {
    return this.changeState(auth, id, 'ACTIVE', meta);
  }

  deactivate(auth: AuthContext, id: string, meta: RequestMeta) {
    return this.changeState(auth, id, 'DEACTIVATED', meta);
  }

  private async changeState(
    auth: AuthContext,
    id: string,
    state: 'ACTIVE' | 'DEACTIVATED',
    meta: RequestMeta,
  ): Promise<AccountNode> {
    await this.tx.run(async (tx) => {
      const target = await this.lockTarget(auth, id, tx);
      assertAllowed(
        can(auth.actor, {
          action: state === 'ACTIVE' ? 'ACTIVATE' : 'DEACTIVATE',
          target: target.facts,
        }),
      );
      const { partners } = orgTables(target.orgSchema);
      await tx
        .update(partners)
        .set({ state })
        .where(eq(partners.accountId, id));
      // Deactivation cuts the person off at once, in the same transaction.
      if (state === 'DEACTIVATED') await this.sessions.revokeAllFor(id, tx);

      await this.audit.record(tx, {
        actorAccountId: auth.accountId,
        action: state === 'ACTIVE' ? 'account.activate' : 'account.deactivate',
        objectType: 'account',
        objectId: id,
        subjectAccountId: id,
        before: { state: target.partner.state },
        after: { state },
        meta,
      });
    });
    return this.viewAfterChange(auth, id);
  }

  async changeRole(
    auth: AuthContext,
    id: string,
    newRole: Role,
    meta: RequestMeta,
  ): Promise<AccountNode> {
    await this.tx.run(async (tx) => {
      const target = await this.lockTarget(auth, id, tx);
      assertAllowed(
        can(auth.actor, {
          action: 'CHANGE_ROLE',
          target: target.facts,
          newRole,
        }),
      );
      if (target.partner.role === newRole) return;

      const { partners, roleHistory } = orgTables(target.orgSchema);
      await tx
        .update(partners)
        .set({ role: newRole })
        .where(eq(partners.accountId, id));
      await tx
        .insert(roleHistory)
        .values({ accountId: id, role: newRole, changedBy: auth.accountId });
      await this.audit.record(tx, {
        actorAccountId: auth.accountId,
        action: 'account.role.change',
        objectType: 'account',
        objectId: id,
        subjectAccountId: id,
        before: { role: target.partner.role },
        after: { role: newRole },
        meta,
      });
    });
    return this.viewAfterChange(auth, id);
  }

  async changeStatus(
    auth: AuthContext,
    id: string,
    status: PartnerStatus,
    meta: RequestMeta,
  ): Promise<AccountNode> {
    await this.tx.run(async (tx) => {
      const target = await this.lockTarget(auth, id, tx);
      assertAllowed(
        can(auth.actor, { action: 'CHANGE_STATUS', target: target.facts }),
      );
      if (target.partner.status === status) return;

      const { partners } = orgTables(target.orgSchema);
      await tx
        .update(partners)
        .set({ status })
        .where(eq(partners.accountId, id));
      await this.audit.record(tx, {
        actorAccountId: auth.accountId,
        action: 'account.status.change',
        objectType: 'account',
        objectId: id,
        subjectAccountId: id,
        before: { status: target.partner.status },
        after: { status },
        meta,
      });
    });
    return this.viewAfterChange(auth, id);
  }

  /**
   * The owner fills in their profile (also while awaiting activation). Once
   * name, phone and consents are all there, the profile counts as completed and
   * the person who may activate the account is told, once (decision 85).
   */
  async updateOwnProfile(
    auth: AuthContext,
    input: UpdateProfile,
    meta: RequestMeta,
    now = new Date(),
  ): Promise<MyProfile> {
    assertAllowed(can(auth.actor, { action: 'UPDATE_OWN_PROFILE' }));
    // A SuperAdministrator has no Partner profile.
    if (!auth.orgSchema) {
      throw appError('FORBIDDEN', { reason: 'insufficient_role' });
    }
    const orgSchema = auth.orgSchema;

    await this.tx.run(async (tx) => {
      const { partners } = orgTables(orgSchema);
      const [current] = await tx
        .select()
        .from(partners)
        .where(eq(partners.accountId, auth.accountId))
        .for('update');
      if (!current) throw appError('NOT_FOUND');

      const firstName = input.firstName ?? current.firstName;
      const lastName = input.lastName ?? current.lastName;
      const phone = input.phone ?? current.phone;
      const consentsAcceptedAt =
        current.consentsAcceptedAt ?? (input.acceptConsents ? now : null);
      const complete = Boolean(
        firstName && lastName && phone && consentsAcceptedAt,
      );
      const completesNow = complete && !current.profileCompletedAt;

      await tx
        .update(partners)
        .set({
          firstName,
          lastName,
          phone,
          consentsAcceptedAt,
          profileCompletedAt: completesNow ? now : current.profileCompletedAt,
        })
        .where(eq(partners.accountId, auth.accountId));

      await this.audit.record(tx, {
        actorAccountId: auth.accountId,
        action: 'account.profile.update',
        objectType: 'account',
        objectId: auth.accountId,
        subjectAccountId: auth.accountId,
        before: {
          firstName: current.firstName,
          lastName: current.lastName,
          phone: current.phone,
          consentsAcceptedAt: current.consentsAcceptedAt,
          profileCompletedAt: current.profileCompletedAt,
        },
        after: {
          firstName,
          lastName,
          phone,
          consentsAcceptedAt,
          profileCompletedAt: completesNow ? now : current.profileCompletedAt,
        },
        meta,
      });

      if (completesNow) {
        await this.notifyProfileCompleted(
          tx,
          auth,
          fullName(firstName, lastName),
        );
      }
    });

    const profile = await this.myProfile(auth);
    if (!profile) throw appError('NOT_FOUND');
    return profile;
  }

  /** Name and phone of somebody else's account (decision 85). */
  async updateAccountData(
    auth: AuthContext,
    id: string,
    input: UpdateAccountData,
    meta: RequestMeta,
  ): Promise<AccountNode> {
    await this.tx.run(async (tx) => {
      const target = await this.lockTarget(auth, id, tx);
      assertAllowed(
        can(auth.actor, { action: 'UPDATE_ACCOUNT', target: target.facts }),
      );
      const changes = {
        firstName: input.firstName ?? target.partner.firstName,
        lastName: input.lastName ?? target.partner.lastName,
        phone: input.phone ?? target.partner.phone,
      };
      const { partners } = orgTables(target.orgSchema);
      await tx.update(partners).set(changes).where(eq(partners.accountId, id));
      await this.audit.record(tx, {
        actorAccountId: auth.accountId,
        action: 'account.update',
        objectType: 'account',
        objectId: id,
        subjectAccountId: id,
        before: {
          firstName: target.partner.firstName,
          lastName: target.partner.lastName,
          phone: target.partner.phone,
        },
        after: changes,
        meta,
      });
    });
    return this.viewAfterChange(auth, id);
  }

  /** The number stays reserved and unique, so only a SuperAdministrator edits it. */
  async updatePartnerNumber(
    auth: AuthContext,
    id: string,
    input: PartnerNumberChange,
    meta: RequestMeta,
  ): Promise<AccountNode> {
    await this.tx.run(async (tx) => {
      const target = await this.lockTarget(auth, id, tx);
      assertAllowed(
        can(auth.actor, {
          action: 'CHANGE_PARTNER_NUMBER',
          target: target.facts,
        }),
      );
      const [before] = await tx
        .select({
          partnerNumber: accounts.partnerNumber,
          partnerCountry: accounts.partnerCountry,
        })
        .from(accounts)
        .where(eq(accounts.id, id));
      try {
        await tx
          .update(accounts)
          .set({
            partnerNumber: input.partnerNumber,
            partnerCountry: input.country,
          })
          .where(eq(accounts.id, id));
      } catch (error) {
        if (
          pgErrorCode(error) === PG_UNIQUE_VIOLATION &&
          pgConstraintName(error) === 'accounts_partner_number_key'
        ) {
          throw appError('PARTNER_NUMBER_TAKEN');
        }
        throw error;
      }
      await this.audit.record(tx, {
        actorAccountId: auth.accountId,
        action: 'account.partner_number.change',
        objectType: 'account',
        objectId: id,
        subjectAccountId: id,
        before,
        after: {
          partnerNumber: input.partnerNumber,
          partnerCountry: input.country,
        },
        meta,
      });
    });
    return this.viewAfterChange(auth, id);
  }

  /**
   * Moves a person, with their whole downline, under another sponsor of the
   * same organization (decision 71). `invited_by_id` never changes; the old
   * sponsor stays in the log. The moved person and the new sponsor are told.
   */
  async changeRecommender(
    auth: AuthContext,
    id: string,
    newRecommenderId: string,
    meta: RequestMeta,
  ): Promise<AccountNode> {
    await this.tx.run(async (tx) => {
      await this.lockOrgOf(tx, id);
      const target = await this.lockTarget(auth, id, tx);
      const facts = await this.relations.newRecommenderFacts(
        auth,
        target,
        newRecommenderId,
        tx,
      );
      // An unknown sponsor and one the caller cannot name look the same.
      if (!facts) throw appError('NOT_FOUND');
      assertAllowed(
        can(auth.actor, {
          action: 'CHANGE_RECOMMENDER',
          target: target.facts,
          newRecommender: facts,
        }),
      );
      // Moving somebody under the sponsor they already have changes nothing.
      if (target.partner.recommenderId === newRecommenderId) return;

      const { partners } = orgTables(target.orgSchema);
      await tx
        .update(partners)
        .set({ recommenderId: newRecommenderId })
        .where(eq(partners.accountId, id));
      await this.audit.record(tx, {
        actorAccountId: auth.accountId,
        action: 'account.recommender.change',
        objectType: 'account',
        objectId: id,
        subjectAccountId: id,
        before: { recommenderId: target.partner.recommenderId },
        after: { recommenderId: newRecommenderId },
        meta,
      });

      const moved = await this.contact(tx, target.orgSchema, id);
      const sponsor = await this.contact(
        tx,
        target.orgSchema,
        newRecommenderId,
      );
      if (moved && sponsor) {
        await this.outbox.enqueue(tx, {
          type: 'recommenderChanged',
          recipientEmail: moved.email,
          locale: moved.locale,
          payload: {
            variant: 'moved',
            personName: moved.name,
            recommenderName: sponsor.name,
          },
        });
        await this.outbox.enqueue(tx, {
          type: 'recommenderChanged',
          recipientEmail: sponsor.email,
          locale: sponsor.locale,
          payload: {
            variant: 'newRecommender',
            personName: moved.name,
            recommenderName: sponsor.name,
          },
        });
      }
    });
    return this.viewAfterChange(auth, id);
  }

  /**
   * Takes a person out of the structure (decisions 72 and 79): those they
   * sponsored move up to their sponsor, the account is marked removed and
   * deactivated and disappears from the tree. The row, e-mail and Partner
   * number stay. Nobody is notified.
   */
  async removeFromStructure(
    auth: AuthContext,
    id: string,
    meta: RequestMeta,
    now = new Date(),
  ): Promise<boolean> {
    await this.tx.run(async (tx) => {
      await this.lockOrgOf(tx, id);
      const target = await this.lockTarget(auth, id, tx);
      assertAllowed(
        can(auth.actor, {
          action: 'REMOVE_FROM_STRUCTURE',
          target: target.facts,
        }),
      );
      const parentId = target.partner.recommenderId;
      // Not reachable: only the root of an organization has no sponsor.
      if (!parentId) throw appError('FORBIDDEN', { reason: 'root_locked' });

      const { partners } = orgTables(target.orgSchema);
      const children = await tx
        .select({ accountId: partners.accountId })
        .from(partners)
        .where(and(eq(partners.recommenderId, id), isNull(partners.removedAt)));
      if (children.length > 0) {
        await tx
          .update(partners)
          .set({ recommenderId: parentId })
          .where(
            and(eq(partners.recommenderId, id), isNull(partners.removedAt)),
          );
        for (const child of children) {
          await this.audit.record(tx, {
            actorAccountId: auth.accountId,
            action: 'account.recommender.change',
            objectType: 'account',
            objectId: child.accountId,
            subjectAccountId: child.accountId,
            before: { recommenderId: id },
            after: { recommenderId: parentId, reason: 'removal' },
            meta,
          });
        }
      }

      await tx
        .update(partners)
        .set({
          removedAt: now,
          removedBy: auth.accountId,
          removedRecommenderId: parentId,
          recommenderId: null,
          state: 'DEACTIVATED',
        })
        .where(eq(partners.accountId, id));
      await this.sessions.revokeAllFor(id, tx);
      await this.audit.record(tx, {
        actorAccountId: auth.accountId,
        action: 'account.remove',
        objectType: 'account',
        objectId: id,
        subjectAccountId: id,
        before: { recommenderId: parentId, state: target.partner.state },
        after: {
          removedAt: now,
          removedRecommenderId: parentId,
          state: 'DEACTIVATED',
          movedDownline: children.map((child) => child.accountId),
        },
        meta,
      });
    });
    return true;
  }

  /**
   * Whom the person could be moved under: activated members of the caller's
   * downline (a SuperAdministrator: of the whole organization), except the
   * person, their downline and their current sponsor.
   */
  async recommenderCandidates(
    auth: AuthContext,
    id: string,
  ): Promise<RecommenderCandidate[]> {
    assertAllowed(can(auth.actor, { action: 'VIEW_STRUCTURE' }));
    const target = await this.relations.targetFacts(auth, id);
    if (!target || !this.visible(auth, target)) throw appError('NOT_FOUND');
    assertAllowed(
      can(auth.actor, {
        action: 'CHANGE_RECOMMENDER',
        target: target.facts,
        newRecommender: ANY_VALID_RECOMMENDER,
      }),
    );

    const scopeRoot =
      auth.actor.role === 'SUPER_ADMINISTRATOR'
        ? await this.orgRootId(target.orgSchema)
        : auth.accountId;
    if (!scopeRoot) return [];

    const excluded = new Set(
      (await this.relations.downline(target.orgSchema, id)).map(
        (entry) => entry.accountId,
      ),
    );
    if (target.partner.recommenderId)
      excluded.add(target.partner.recommenderId);

    const candidates = (
      await this.relations.downline(target.orgSchema, scopeRoot)
    ).filter((entry) => !excluded.has(entry.accountId));
    // The current sponsor is excluded above, but the people above them are fine.
    const rows = await this.rowsOf(
      target.orgSchema,
      candidates.map((entry) => entry.accountId),
    );
    return candidates.flatMap(({ accountId, depth }) => {
      const row = rows.get(accountId);
      if (!row || row.partner.state !== 'ACTIVE') return [];
      return [
        {
          id: accountId,
          email: row.email,
          firstName: row.partner.firstName,
          lastName: row.partner.lastName,
          depth,
        },
      ];
    });
  }

  /**
   * Promotes a person to Platinum (decisions 64 and 77): they and their whole
   * downline move into a new organization schema, all in one transaction. The
   * line above keeps only a marker. Irreversible (Platinums are never demoted).
   */
  async promote(
    auth: AuthContext,
    id: string,
    meta: RequestMeta,
    now = new Date(),
  ): Promise<AccountNode> {
    await this.tx.run(async (tx) => {
      await this.lockOrgOf(tx, id);
      const target = await this.lockTarget(auth, id, tx);
      assertAllowed(
        can(auth.actor, { action: 'PROMOTE', target: target.facts }),
      );
      await this.promotion.promote(tx, { auth, target, meta, now });
    });
    return this.viewAfterChange(auth, id);
  }

  // ------------------------------------------------------------- helpers

  /**
   * The target of a change, its row locked until the transaction ends. An
   * account the caller may not see looks exactly like one that does not exist.
   */
  private async lockTarget(
    auth: AuthContext,
    id: string,
    tx: Tx,
  ): Promise<LoadedTarget> {
    const loaded = await this.relations.targetFacts(auth, id, tx, {
      lock: true,
    });
    if (!loaded || !this.visible(auth, loaded)) throw appError('NOT_FOUND');
    return loaded;
  }

  /** Takes the structure lock of the organization the account belongs to. */
  private async lockOrgOf(tx: Tx, accountId: string): Promise<void> {
    const [account] = await tx
      .select({ orgSchema: accounts.orgSchema })
      .from(accounts)
      .where(eq(accounts.id, accountId));
    if (!account?.orgSchema) throw appError('NOT_FOUND');
    await this.relations.lockOrg(tx, account.orgSchema);
  }

  /** Where to write to a person: their address, language and the name to show. */
  private async contact(
    tx: Tx,
    orgSchema: string,
    accountId: string,
  ): Promise<{ email: string; locale: string; name: string } | null> {
    const { partners } = orgTables(orgSchema);
    const [row] = await tx
      .select({
        email: accounts.email,
        locale: accounts.locale,
        firstName: partners.firstName,
        lastName: partners.lastName,
      })
      .from(partners)
      .innerJoin(accounts, eq(accounts.id, partners.accountId))
      .where(eq(partners.accountId, accountId));
    if (!row) return null;
    return {
      email: row.email,
      locale: row.locale,
      name: fullName(row.firstName, row.lastName) || row.email,
    };
  }

  /** Visible: oneself, the downline, or anybody for a SuperAdministrator. */
  private visible(auth: AuthContext, loaded: LoadedTarget): boolean {
    return (
      auth.actor.role === 'SUPER_ADMINISTRATOR' ||
      loaded.facts.isSelf ||
      loaded.facts.actorIsAncestor ||
      // The line above sees the account of a Platinum who was detached.
      loaded.facts.actorIsAboveOrg
    );
  }

  private async viewAfterChange(
    auth: AuthContext,
    id: string,
  ): Promise<AccountNode> {
    const node = await this.view(auth, id);
    // Not reachable: the caller saw the account a moment ago.
    if (!node) throw appError('NOT_FOUND');
    return node;
  }

  /**
   * Who is told that a profile is complete: the Platinum at the head of the
   * organization, or every SuperAdministrator when that is the account itself
   * or the Platinum cannot act (decision 85).
   */
  private async notifyProfileCompleted(
    tx: Tx,
    auth: AuthContext,
    accountName: string,
  ): Promise<void> {
    const rootId = await this.orgRootId(auth.orgSchema!, tx);
    let recipients: { email: string; locale: string }[] = [];

    if (rootId && rootId !== auth.accountId) {
      const { partners } = orgTables(auth.orgSchema!);
      const [root] = await tx
        .select({
          email: accounts.email,
          locale: accounts.locale,
          state: partners.state,
        })
        .from(partners)
        .innerJoin(accounts, eq(accounts.id, partners.accountId))
        .where(eq(partners.accountId, rootId));
      if (root?.state === 'ACTIVE') recipients = [root];
    }
    if (recipients.length === 0) {
      recipients = await tx
        .select({ email: accounts.email, locale: accounts.locale })
        .from(accounts)
        .where(eq(accounts.isSuperAdmin, true));
    }

    const url = `${this.config.get('APP_BASE_URL', { infer: true })}/accounts/${auth.accountId}`;
    for (const recipient of recipients) {
      await this.outbox.enqueue(tx, {
        type: 'profileCompleted',
        recipientEmail: recipient.email,
        locale: recipient.locale,
        payload: { accountName, url },
      });
    }
  }

  private async orgRootId(
    orgSchema: string,
    executor: Database | Tx = this.db,
  ): Promise<string | null> {
    const [org] = await executor
      .select({ rootAccountId: orgSchemas.rootAccountId })
      .from(orgSchemas)
      .where(eq(orgSchemas.name, orgSchema));
    return org?.rootAccountId ?? null;
  }

  private async rowsOf(
    orgSchema: string,
    ids: string[],
  ): Promise<Map<string, AccountRow>> {
    const { partners } = orgTables(orgSchema);
    const rows = await this.db
      .select({
        partner: partners,
        email: accounts.email,
        partnerNumber: accounts.partnerNumber,
        partnerCountry: accounts.partnerCountry,
        accountOrg: accounts.orgSchema,
      })
      .from(partners)
      .innerJoin(accounts, eq(accounts.id, partners.accountId))
      .where(inArray(partners.accountId, ids));

    const result = new Map<string, AccountRow>();
    for (const { accountOrg, ...row } of rows) {
      const id = row.partner.accountId;
      if (!accountOrg || accountOrg === orgSchema) {
        result.set(id, { ...row, detached: null });
        continue;
      }
      // A marker: the person now heads another organization. Their real row
      // (role, status, state, data) lives there.
      const [real] = await this.db
        .select({ partner: orgTables(accountOrg).partners })
        .from(orgTables(accountOrg).partners)
        .where(eq(orgTables(accountOrg).partners.accountId, id));
      const detached = await this.promotionOf(accountOrg);
      result.set(id, {
        ...row,
        partner: real?.partner ?? row.partner,
        detached,
      });
    }
    return result;
  }

  /** Who promoted the head of an organization and when (null for founded organizations). */
  private async promotionOf(
    orgSchema: string,
  ): Promise<{ promotedAt: Date; promotedBy: string } | null> {
    const [org] = await this.db
      .select({ at: orgSchemas.promotedAt, by: orgSchemas.promotedBy })
      .from(orgSchemas)
      .where(eq(orgSchemas.name, orgSchema));
    return org?.at && org.by
      ? { promotedAt: org.at, promotedBy: org.by }
      : null;
  }

  private async rowOf(
    orgSchema: string,
    id: string,
  ): Promise<AccountRow | undefined> {
    return (await this.rowsOf(orgSchema, [id])).get(id);
  }

  /** The account as the caller sees it, with what they may do (decided by `can`). */
  private describe(
    actor: Actor,
    facts: TargetFacts,
    row: AccountRow,
  ): AccountNode {
    const assignableRoles = ROLES.filter(
      (role) =>
        role !== facts.role &&
        can(actor, { action: 'CHANGE_ROLE', target: facts, newRole: role })
          .allowed,
    );
    const allowedActions = ACCOUNT_ACTIONS.filter(
      (action): action is AccountAction => {
        switch (action) {
          case 'CHANGE_ROLE':
            return assignableRoles.length > 0;
          case 'CHANGE_RECOMMENDER':
            return can(actor, {
              action,
              target: facts,
              newRecommender: ANY_VALID_RECOMMENDER,
            }).allowed;
          default:
            return can(actor, { action, target: facts }).allowed;
        }
      },
    );
    const { partner } = row;
    return {
      id: partner.accountId,
      email: row.email,
      firstName: partner.firstName,
      lastName: partner.lastName,
      phone: partner.phone,
      partnerNumber: row.partnerNumber,
      partnerCountry: row.partnerCountry,
      role: partner.role,
      status: partner.status,
      state: partner.state,
      profileCompleted: partner.profileCompletedAt !== null,
      recommenderId: partner.recommenderId,
      isOrgRoot: facts.isOrgRoot,
      detachedOrg: row.detached !== null,
      promotedAt: row.detached?.promotedAt ?? null,
      promotedBy: row.detached?.promotedBy ?? null,
      removed: facts.removed,
      createdAt: partner.createdAt,
      allowedActions,
      assignableRoles,
    };
  }
}
