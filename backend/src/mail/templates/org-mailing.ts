import type { Locale } from '../../common/locales.js';
import { escapeHtml } from './invitation.js';

export interface OrgMailingMailPayload {
  /** Who sends it (name, or e-mail when they have no name yet). */
  senderName: string;
  /** Versions by language; `pl` is always there and is the fallback. */
  content: Record<string, { subject: string; body: string }>;
}

const FOOTER: Record<Locale, (sender: string) => string> = {
  pl: (sender) => `Wiadomość od: ${sender}, w ramach dMb Projekt 2027.`,
  de: (sender) => `Nachricht von: ${sender}, im Rahmen von dMb Projekt 2027.`,
  en: (sender) => `Message from: ${sender}, within dMb Projekt 2027.`,
};

/** Plain text to HTML: blank lines separate paragraphs, single line breaks stay. */
function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part).replaceAll('\n', '<br>')}</p>`)
    .join('\n');
}

export function renderOrgMailing(
  payload: OrgMailingMailPayload,
  locale: Locale,
) {
  // The recipient's language when the sender wrote it, Polish otherwise.
  const version = payload.content[locale] ?? payload.content.pl!;
  const footer = FOOTER[locale](payload.senderName);
  return {
    subject: version.subject,
    text: [version.body.trim(), '', '--', footer].join('\n'),
    html: [
      paragraphs(version.body),
      `<hr><p><small>${escapeHtml(footer)}</small></p>`,
    ].join('\n'),
  };
}
