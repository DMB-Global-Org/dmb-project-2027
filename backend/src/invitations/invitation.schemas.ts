import { z } from 'zod';
import {
  email,
  firstInvalidField,
  partnerCountry,
  partnerNumber,
  phone,
  stripNulls,
} from '../common/field-schemas.js';
import { SUPPORTED_LOCALES } from '../common/locales.js';
import { MAX_PASSWORD_LENGTH } from '../auth/password.js';

export const createInvitationSchema = z.preprocess(
  stripNulls,
  z
    .object({
      kind: z.enum(['PARTNER', 'PLATINUM']),
      recommenderId: z.uuid().optional(),
      recipientEmail: email.optional(),
      recipientPhone: phone.optional(),
      locale: z.enum(SUPPORTED_LOCALES).default('pl'),
      sendEmail: z.boolean().default(false),
    })
    .refine((v) => v.recipientEmail || v.recipientPhone, {
      path: ['recipientEmail'],
      message: 'recipient_required',
    })
    .refine((v) => !v.sendEmail || v.recipientEmail, {
      path: ['recipientEmail'],
      message: 'email_required_to_send',
    }),
);

export const registerSchema = z.preprocess(
  stripNulls,
  z
    .object({
      token: z.string().min(1).max(200),
      email,
      password: z
        .string()
        .min(1)
        .max(MAX_PASSWORD_LENGTH + 1),
      passwordConfirmation: z.string(),
      country: partnerCountry.default('PL'),
      partnerNumber,
    })
    .refine((v) => v.password === v.passwordConfirmation, {
      path: ['passwordConfirmation'],
      message: 'mismatch',
    }),
);

export { firstInvalidField };
