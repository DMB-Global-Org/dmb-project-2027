/** Interface and e-mail languages (rule 10); Polish is the default. */
export const SUPPORTED_LOCALES = ['pl', 'de', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'pl';
