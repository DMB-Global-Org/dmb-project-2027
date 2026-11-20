import { z } from 'zod';
import { appError } from './graphql-error.js';

/**
 * GraphQL clients may send an explicit `null` for an optional field; treat it
 * like an omitted one so defaults apply.
 */
export function stripNulls(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== null),
  );
}

export const email = z.string().trim().toLowerCase().max(320).pipe(z.email());

// Phone used in WhatsApp: digits with the usual separators, optional "+".
export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{5,25}$/);

/** A stored phone number: separators dropped, so one number is one string. */
export const normalizedPhone = phone.transform((v) => v.replace(/[ ()-]/g, ''));

/** ISO 3166-1 alpha-2, upper case; Poland unless said otherwise. */
export const partnerCountry = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/)
  .transform((v) => v.toUpperCase());

// Partner numbers are digits only, whatever the country: 6 to 12 of them
// (now 10). Whitespace typed for readability is dropped, so "123 456 789 0"
// and "1234567890" cannot become two accounts.
export const partnerNumber = z
  .string()
  .transform((v) => v.replace(/\s+/g, ''))
  .pipe(z.string().regex(/^[0-9]{6,12}$/));

/** The first invalid field of a failed parse, for the error `extensions`. */
export function firstInvalidField(error: z.ZodError): string {
  return String(error.issues[0]?.path[0] ?? 'input');
}

/** A uuid from the API; anything else cannot name an account, so it is "not found". */
export function parseId(value: string): string {
  if (!z.uuid().safeParse(value).success) throw appError('NOT_FOUND');
  return value;
}
