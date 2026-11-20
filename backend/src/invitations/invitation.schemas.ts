import { z } from 'zod';
import { SUPPORTED_LOCALES } from '../common/locales.js';
import { MAX_PASSWORD_LENGTH } from '../auth/password.js';

const email = z.string().trim().toLowerCase().max(320).pipe(z.email());

// Phone used in WhatsApp: digits with the usual separators, optional "+".
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{5,25}$/);

export const createInvitationSchema = z
  .object({
    kind: z.enum(['PARTNER', 'PLATINUM']),
    recommenderId: z.uuid().optional(),
    recipientEmail: email.optional(),
    recipientPhone: phone.optional(),
    locale: z.enum(SUPPORTED_LOCALES).default('pl'),
  })
  .refine((v) => v.recipientEmail || v.recipientPhone, {
    path: ['recipientEmail'],
    message: 'recipient_required',
  });

export const registerSchema = z
  .object({
    token: z.string().min(1).max(200),
    email,
    password: z
      .string()
      .min(1)
      .max(MAX_PASSWORD_LENGTH + 1),
    passwordConfirmation: z.string(),
    country: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/)
      .transform((v) => v.toUpperCase())
      .default('PL'),
    // The format of Amway numbers is not specified; only characters and
    // length are checked. Whitespace is dropped and letters upper-cased, so
    // "ab 123" and "AB123" cannot become two accounts.
    partnerNumber: z
      .string()
      .transform((v) => v.replace(/\s+/g, '').toUpperCase())
      .pipe(z.string().regex(/^[0-9A-Z-]{3,20}$/)),
  })
  .refine((v) => v.password === v.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'mismatch',
  });

/** The first invalid field of a failed parse, for the error `extensions`. */
export function firstInvalidField(error: z.ZodError): string {
  return String(error.issues[0]?.path[0] ?? 'input');
}
