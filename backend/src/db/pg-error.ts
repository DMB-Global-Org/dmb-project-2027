/**
 * Reads a field of the Postgres error behind `error`: drizzle wraps the driver
 * error in `cause`, postgres.js throws it directly.
 */
function pgField(error: unknown, field: string): string | undefined {
  let current: unknown = error;
  while (current && typeof current === 'object') {
    const value = (current as Record<string, unknown>)[field];
    if (typeof value === 'string') return value;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** The SQLSTATE code of a database error, if `error` is one. */
export function pgErrorCode(error: unknown): string | undefined {
  const code = pgField(error, 'code');
  return code && /^[0-9A-Z]{5}$/.test(code) ? code : undefined;
}

/** The violated constraint of a database error, if it names one. */
export function pgConstraintName(error: unknown): string | undefined {
  return pgField(error, 'constraint_name');
}

/** SQLSTATE codes we react to. */
export const PG_UNIQUE_VIOLATION = '23505';
