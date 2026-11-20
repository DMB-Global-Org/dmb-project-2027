import { GraphQLError } from 'graphql';

/**
 * Machine-readable error codes. The API returns codes, never user-facing
 * text: the frontend maps each code to a translated message (rule 10).
 */
export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_DEACTIVATED'
  | 'TOO_MANY_ATTEMPTS'
  | 'VALIDATION_FAILED'
  // The permission engine said no; `reason` carries its DenyReason.
  | 'FORBIDDEN'
  // Unknown, or outside what the caller may see (the two look the same).
  | 'NOT_FOUND'
  // Unknown, expired, already used, or its inviter can no longer invite.
  | 'INVITATION_INVALID'
  | 'EMAIL_TAKEN'
  | 'PARTNER_NUMBER_TAKEN'
  // An organizational mailing that would reach nobody.
  | 'NO_RECIPIENTS';

/** `details` (e.g. `{ field }` or `{ reason }`) ends up in `extensions` next to the code. */
export function appError(
  code: ErrorCode,
  details?: Record<string, string>,
): GraphQLError {
  return new GraphQLError(code, { extensions: { ...details, code } });
}
