import { z } from 'zod';
import {
  partnerCountry,
  partnerNumber,
  normalizedPhone,
  stripNulls,
} from '../common/field-schemas.js';

const personName = z.string().trim().min(1).max(100);

/** Fields not sent (or sent as null) keep their current value. */
export const updateProfileSchema = z.preprocess(
  stripNulls,
  z.object({
    firstName: personName.optional(),
    lastName: personName.optional(),
    phone: normalizedPhone.optional(),
    acceptConsents: z.boolean().optional(),
  }),
);

export const updateAccountDataSchema = z.preprocess(
  stripNulls,
  z.object({
    firstName: personName.optional(),
    lastName: personName.optional(),
    phone: normalizedPhone.optional(),
  }),
);

export const partnerNumberSchema = z.preprocess(
  stripNulls,
  z.object({
    country: partnerCountry.default('PL'),
    partnerNumber,
  }),
);

export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type UpdateAccountData = z.infer<typeof updateAccountDataSchema>;
export type PartnerNumberChange = z.infer<typeof partnerNumberSchema>;
