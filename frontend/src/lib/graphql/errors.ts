/** Codes returned by the API (backend `ErrorCode`) plus two client-side ones. */
export const API_ERROR_CODES = [
  "UNAUTHENTICATED",
  "INVALID_CREDENTIALS",
  "ACCOUNT_DEACTIVATED",
  "TOO_MANY_ATTEMPTS",
  "VALIDATION_FAILED",
  "FORBIDDEN",
  "INVITATION_INVALID",
  "EMAIL_TAKEN",
  "PARTNER_NUMBER_TAKEN",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number] | "NETWORK" | "UNKNOWN";

/** An error from the GraphQL API. `code` is translated via `errors.<code>`. */
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    /** e.g. `{ field }` for VALIDATION_FAILED, `{ reason }` for FORBIDDEN. */
    readonly details: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export function toApiErrorCode(value: unknown): ApiErrorCode {
  return API_ERROR_CODES.find((code) => code === value) ?? "UNKNOWN";
}
