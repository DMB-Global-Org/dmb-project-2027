import type { Locale } from '../../common/locales.js';

export interface InvitationMailPayload {
  /** Full registration link, including the token. */
  url: string;
  kind: 'PARTNER' | 'PLATINUM';
  /** ISO timestamp. */
  expiresAt: string;
  /** Name of the person who invites; left out when they have not given one. */
  inviterName?: string;
}

interface Texts {
  subject: string;
  greeting: string;
  body: (kind: InvitationMailPayload['kind']) => string;
  invitedBy: (name: string) => string;
  action: string;
  validUntil: (when: string) => string;
  ignore: string;
}

const TEXTS: Record<Locale, Texts> = {
  pl: {
    subject: 'Zaproszenie do dMb Projekt 2027',
    greeting: 'Dzień dobry,',
    body: (kind) =>
      kind === 'PLATINUM'
        ? 'zapraszamy Cię do założenia konta Platyny w aplikacji dMb Projekt 2027.'
        : 'zapraszamy Cię do założenia konta w aplikacji dMb Projekt 2027.',
    invitedBy: (name) => `Zaprasza Cię: ${name}.`,
    action: 'Załóż konto',
    validUntil: (when) => `Link jest ważny do ${when}.`,
    ignore: 'Jeśli to zaproszenie nie jest dla Ciebie, zignoruj tę wiadomość.',
  },
  de: {
    subject: 'Einladung zu dMb Projekt 2027',
    greeting: 'Guten Tag,',
    body: (kind) =>
      kind === 'PLATINUM'
        ? 'wir laden Sie ein, in der Anwendung dMb Projekt 2027 ein Platin-Konto anzulegen.'
        : 'wir laden Sie ein, in der Anwendung dMb Projekt 2027 ein Konto anzulegen.',
    invitedBy: (name) => `Eingeladen von: ${name}.`,
    action: 'Konto anlegen',
    validUntil: (when) => `Der Link ist gültig bis ${when}.`,
    ignore:
      'Wenn diese Einladung nicht für Sie bestimmt ist, ignorieren Sie diese Nachricht.',
  },
  en: {
    subject: 'Invitation to dMb Projekt 2027',
    greeting: 'Hello,',
    body: (kind) =>
      kind === 'PLATINUM'
        ? 'you are invited to create a Platinum account in the dMb Projekt 2027 application.'
        : 'you are invited to create an account in the dMb Projekt 2027 application.',
    invitedBy: (name) => `Invited by: ${name}.`,
    action: 'Create account',
    validUntil: (when) => `The link is valid until ${when}.`,
    ignore:
      'If this invitation is not meant for you, please ignore this message.',
  },
};

const FORMAT_LOCALE: Record<Locale, string> = {
  pl: 'pl-PL',
  de: 'de-DE',
  en: 'en-GB',
};

export function formatDeadline(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(FORMAT_LOCALE[locale], {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Warsaw',
  }).format(new Date(iso));
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderInvitation(
  payload: InvitationMailPayload,
  locale: Locale,
) {
  const t = TEXTS[locale];
  const when = formatDeadline(payload.expiresAt, locale);
  const text = [
    t.greeting,
    '',
    t.body(payload.kind),
    ...(payload.inviterName ? [t.invitedBy(payload.inviterName)] : []),
    '',
    `${t.action}: ${payload.url}`,
    '',
    t.validUntil(when),
    t.ignore,
  ].join('\n');
  const url = escapeHtml(payload.url);
  const html = [
    `<p>${t.greeting}</p>`,
    `<p>${escapeHtml(t.body(payload.kind))}${
      payload.inviterName
        ? `<br>${escapeHtml(t.invitedBy(payload.inviterName))}`
        : ''
    }</p>`,
    `<p><a href="${url}">${escapeHtml(t.action)}</a></p>`,
    `<p>${escapeHtml(t.validUntil(when))}<br>${escapeHtml(t.ignore)}</p>`,
  ].join('\n');
  return { subject: t.subject, text, html };
}
