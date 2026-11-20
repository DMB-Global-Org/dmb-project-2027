import type { Locale } from '../../common/locales.js';
import { escapeHtml } from './invitation.js';

export interface PromotedMailPayload {
  /** The application page to start from. */
  url: string;
}

interface Texts {
  subject: string;
  greeting: string;
  body: string;
  action: string;
}

const TEXTS: Record<Locale, Texts> = {
  pl: {
    subject: 'Jesteś Platyną w dMb Projekt 2027',
    greeting: 'Dzień dobry,',
    body: 'Twoje konto w aplikacji dMb Projekt 2027 ma od teraz rolę Platinum. Twoja organizacja jest odrębna i sam nią zarządzasz: aktywujesz konta, nadajesz role i statusy oraz zapraszasz nowe osoby.',
    action: 'Przejdź do aplikacji',
  },
  de: {
    subject: 'Sie sind Platin in dMb Projekt 2027',
    greeting: 'Guten Tag,',
    body: 'Ihr Konto in der Anwendung dMb Projekt 2027 hat ab sofort die Rolle Platin. Ihre Organisation ist eigenständig und Sie verwalten sie selbst: Sie aktivieren Konten, vergeben Rollen und Status und laden neue Personen ein.',
    action: 'Zur Anwendung',
  },
  en: {
    subject: 'You are a Platinum in dMb Projekt 2027',
    greeting: 'Hello,',
    body: 'Your account in the dMb Projekt 2027 application now has the Platinum role. Your organization is separate and you manage it yourself: you activate accounts, give roles and statuses and invite new people.',
    action: 'Open the application',
  },
};

export function renderPromoted(payload: PromotedMailPayload, locale: Locale) {
  const t = TEXTS[locale];
  return {
    subject: t.subject,
    text: [t.greeting, '', t.body, '', `${t.action}: ${payload.url}`].join(
      '\n',
    ),
    html: [
      `<p>${t.greeting}</p>`,
      `<p>${escapeHtml(t.body)}</p>`,
      `<p><a href="${escapeHtml(payload.url)}">${escapeHtml(t.action)}</a></p>`,
    ].join('\n'),
  };
}
