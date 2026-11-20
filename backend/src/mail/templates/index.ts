import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
} from '../../common/locales.js';
import type { MailMessage } from '../mail.types.js';
import { type InvitationMailPayload, renderInvitation } from './invitation.js';
import { type OrgMailingMailPayload, renderOrgMailing } from './org-mailing.js';
import { type PromotedMailPayload, renderPromoted } from './promoted.js';
import {
  type RecommenderChangedMailPayload,
  renderRecommenderChanged,
} from './recommender-changed.js';
import {
  type ProfileCompletedMailPayload,
  renderProfileCompleted,
} from './profile-completed.js';

/** Template name -> the data it needs. New messages are added here. */
export interface NotificationPayloads {
  invitation: InvitationMailPayload;
  profileCompleted: ProfileCompletedMailPayload;
  recommenderChanged: RecommenderChangedMailPayload;
  promoted: PromotedMailPayload;
  orgMailing: OrgMailingMailPayload;
}
export type NotificationType = keyof NotificationPayloads;

const RENDERERS: {
  [T in NotificationType]: (
    payload: NotificationPayloads[T],
    locale: Locale,
  ) => Omit<MailMessage, 'to'>;
} = {
  invitation: renderInvitation,
  profileCompleted: renderProfileCompleted,
  recommenderChanged: renderRecommenderChanged,
  promoted: renderPromoted,
  orgMailing: renderOrgMailing,
};

/** An unknown or unsupported language falls back to Polish (rule 10). */
export function resolveLocale(locale: string): Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale)
    ? (locale as Locale)
    : DEFAULT_LOCALE;
}

export function isNotificationType(type: string): type is NotificationType {
  return type in RENDERERS;
}

export function renderMail<T extends NotificationType>(
  type: T,
  payload: NotificationPayloads[T],
  locale: string,
  to: string,
): MailMessage {
  return { to, ...RENDERERS[type](payload, resolveLocale(locale)) };
}
