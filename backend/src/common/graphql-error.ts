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
  | 'VALIDATION_FAILED';

export function appError(code: ErrorCode): GraphQLError {
  return new GraphQLError(code, { extensions: { code } });
}
