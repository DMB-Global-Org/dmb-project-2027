import { z } from 'zod';
import { stripNulls } from '../common/field-schemas.js';
import { ROLES } from '../db/schema/enums.js';

const subject = z.string().trim().min(1).max(200);
const body = z.string().trim().min(1).max(20_000);

/** Roles a mailing can start from; nobody holds SuperAdministrator in an organization. */
const MIN_ROLES = ROLES.filter((role) => role !== 'SUPER_ADMINISTRATOR');
export const minRoleSchema = z.enum(MIN_ROLES as [string, ...string[]]);

export const sendOrgMailingSchema = z.preprocess(
  stripNulls,
  z
    .object({
      subject,
      body,
      subjectDe: subject.optional(),
      bodyDe: body.optional(),
      subjectEn: subject.optional(),
      bodyEn: body.optional(),
      minRole: minRoleSchema.default('GENERAL'),
    })
    // A language version needs both its subject and its text.
    .refine((v) => Boolean(v.subjectDe) === Boolean(v.bodyDe), {
      path: ['bodyDe'],
      message: 'both_needed',
    })
    .refine((v) => Boolean(v.subjectEn) === Boolean(v.bodyEn), {
      path: ['bodyEn'],
      message: 'both_needed',
    }),
);

export type SendOrgMailing = z.infer<typeof sendOrgMailingSchema>;
