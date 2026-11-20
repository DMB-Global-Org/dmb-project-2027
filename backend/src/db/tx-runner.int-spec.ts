import { sql } from 'drizzle-orm';
import { createTestDb, type TestDb } from '../../test/support/test-db.js';
import { TxRunner } from './tx-runner.js';

describe('TxRunner (integration)', () => {
  let testDb: TestDb;
  let runner: TxRunner;

  const schemaExists = async (name: string) => {
    const rows = await testDb.db.execute(
      sql`select 1 from information_schema.schemata where schema_name = ${name}`,
    );
    return rows.length > 0;
  };

  beforeAll(() => {
    testDb = createTestDb();
    runner = new TxRunner(testDb.db);
  });

  afterAll(async () => {
    await testDb.db.execute(sql`drop schema if exists tx_commit cascade`);
    await testDb.close();
  });

  it('commits DDL when the callback succeeds', async () => {
    await runner.run(async (tx) => {
      await tx.execute(sql`create schema tx_commit`);
    });

    expect(await schemaExists('tx_commit')).toBe(true);
  });

  it('rolls back DDL when the callback throws', async () => {
    await expect(
      runner.run(async (tx) => {
        await tx.execute(sql`create schema tx_rollback`);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await schemaExists('tx_rollback')).toBe(false);
  });

  it('serializes work guarded by the same advisory lock', async () => {
    const order: string[] = [];
    const guarded = (label: string, holdMs: number) =>
      runner.run(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(42)`);
        order.push(`${label}:start`);
        await new Promise((resolve) => setTimeout(resolve, holdMs));
        order.push(`${label}:end`);
      });

    await Promise.all([guarded('a', 150), guarded('b', 0)]);

    // Whoever got the lock first finishes before the other one starts.
    const [first] = order[0]!.split(':');
    expect(order.slice(0, 2)).toEqual([`${first}:start`, `${first}:end`]);
  });
});
