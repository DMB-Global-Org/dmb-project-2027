/**
 * Extracts the Postgres SQLSTATE code from an error thrown by drizzle (which
 * wraps the driver error in `cause`) or by postgres.js directly.
 */
export function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  while (current && typeof current === 'object') {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Runs `fn` and returns the SQLSTATE of the error it throws (fails if none). */
export async function expectPgError(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    const code = pgErrorCode(error);
    if (!code) throw error;
    return code;
  }
  throw new Error('Expected the statement to fail, but it succeeded');
}

// SQLSTATE codes used in tests.
export const PG = {
  restrictViolation: '23001',
  foreignKeyViolation: '23503',
  uniqueViolation: '23505',
  checkViolation: '23514',
} as const;
