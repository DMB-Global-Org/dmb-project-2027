import type { Locale } from '../../common/locales.js';
import { escapeHtml } from './invitation.js';

export interface ProfileCompletedMailPayload {
  /** Name of the account owner, as they typed it. */
  accountName: string;
  /** Page of the account in the application. */
  url: string;
}

interface Texts {
  subject: (name: string) => string;
  greeting: string;
  body: (name: string) => string;
  action: string;
}

const TEXTS: Record<Locale, Texts> = {
  pl: {
    subject: (name) => `Profil uzupełniony: ${name}`,
    greeting: 'Dzień dobry,',
    body: (name) =>
      `${name} uzupełnia profil i czeka na aktywację konta w aplikacji dMb Projekt 2027.`,
    action: 'Przejdź do konta',
  },
  de: {
    subject: (name) => `Profil vervollständigt: ${name}`,
    greeting: 'Guten Tag,',
    body: (name) =>
      `${name} hat das Profil vervollständigt und wartet in der Anwendung dMb Projekt 2027 auf die Aktivierung des Kontos.`,
    action: 'Zum Konto',
  },
  en: {
    subject: (name) => `Profile completed: ${name}`,
    greeting: 'Hello,',
    body: (name) =>
      `${name} has completed their profile and is waiting for the account to be activated in the dMb Projekt 2027 application.`,
    action: 'Open the account',
  },
};

export function renderProfileCompleted(
  payload: ProfileCompletedMailPayload,
  locale: Locale,
) {
  const t = TEXTS[locale];
  const text = [
    t.greeting,
    '',
    t.body(payload.accountName),
    '',
    `${t.action}: ${payload.url}`,
  ].join('\n');
  const html = [
    `<p>${t.greeting}</p>`,
    `<p>${escapeHtml(t.body(payload.accountName))}</p>`,
    `<p><a href="${escapeHtml(payload.url)}">${escapeHtml(t.action)}</a></p>`,
  ].join('\n');
  return { subject: t.subject(payload.accountName), text, html };
}
