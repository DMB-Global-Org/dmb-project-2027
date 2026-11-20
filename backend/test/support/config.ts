const DEFAULT_TEST_DATABASE_URL =
  'postgres://postgres:postgres@localhost:5434/dmb_test';

/**
 * Connection string of the integration-test database. The database name must
 * end with `_test`: the test setup drops schemas, so it refuses anything else
 * (e.g. a Supabase URL pasted in by mistake).
 */
export function testDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_TEST ?? DEFAULT_TEST_DATABASE_URL;
  const database = new URL(url).pathname.slice(1);
  if (!database.endsWith('_test')) {
    throw new Error(
      `Refusing to run integration tests against database "${database}": the name must end with "_test".`,
    );
  }
  return url;
}
