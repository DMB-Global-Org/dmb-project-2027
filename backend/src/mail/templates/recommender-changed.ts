import type { Locale } from '../../common/locales.js';
import { escapeHtml } from './invitation.js';

export interface RecommenderChangedMailPayload {
  /** `moved`: to the person who was moved; `newRecommender`: to the new sponsor. */
  variant: 'moved' | 'newRecommender';
  /** The person who was moved (name, or e-mail when they have no name yet). */
  personName: string;
  /** The new sponsor (name, or e-mail when they have no name yet). */
  recommenderName: string;
}

interface Texts {
  subject: string;
  greeting: string;
  moved: (recommender: string) => string;
  newRecommender: (person: string) => string;
}

const TEXTS: Record<Locale, Texts> = {
  pl: {
    subject: 'Zmiana rekomendującego w dMb Projekt 2027',
    greeting: 'Dzień dobry,',
    moved: (recommender) =>
      `Twoim rekomendującym w aplikacji dMb Projekt 2027 jest od teraz: ${recommender}.`,
    newRecommender: (person) =>
      `${person} jest od teraz w Twojej dolnej linii w aplikacji dMb Projekt 2027, razem ze swoją dolną linią.`,
  },
  de: {
    subject: 'Änderung des Empfehlenden in dMb Projekt 2027',
    greeting: 'Guten Tag,',
    moved: (recommender) =>
      `Ihr Empfehlender in der Anwendung dMb Projekt 2027 ist ab sofort: ${recommender}.`,
    newRecommender: (person) =>
      `${person} gehört ab sofort zu Ihrer Downline in der Anwendung dMb Projekt 2027, zusammen mit der eigenen Downline.`,
  },
  en: {
    subject: 'Change of sponsor in dMb Projekt 2027',
    greeting: 'Hello,',
    moved: (recommender) =>
      `Your sponsor in the dMb Projekt 2027 application is now: ${recommender}.`,
    newRecommender: (person) =>
      `${person} is now in your downline in the dMb Projekt 2027 application, together with their own downline.`,
  },
};

export function renderRecommenderChanged(
  payload: RecommenderChangedMailPayload,
  locale: Locale,
) {
  const t = TEXTS[locale];
  const body =
    payload.variant === 'moved'
      ? t.moved(payload.recommenderName)
      : t.newRecommender(payload.personName);
  return {
    subject: t.subject,
    text: [t.greeting, '', body].join('\n'),
    html: [`<p>${t.greeting}</p>`, `<p>${escapeHtml(body)}</p>`].join('\n'),
  };
}
