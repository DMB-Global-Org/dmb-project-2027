import { pgErrorCode } from '../../src/db/pg-error.js';

export { pgErrorCode };

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
