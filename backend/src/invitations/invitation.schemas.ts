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
    // Partner numbers are digits only, whatever the country: 6 to 12 of them
    // (now 10). Whitespace typed for readability is dropped, so "123 456 789 0"
    // and "1234567890" cannot become two accounts.
    partnerNumber: z
      .string()
      .transform((v) => v.replace(/\s+/g, ''))
      .pipe(z.string().regex(/^[0-9]{6,12}$/)),
  })
  .refine((v) => v.password === v.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'mismatch',
  });

/** The first invalid field of a failed parse, for the error `extensions`. */
export function firstInvalidField(error: z.ZodError): string {
  return String(error.issues[0]?.path[0] ?? 'input');
}
