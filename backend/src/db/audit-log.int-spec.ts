import { eq, sql } from 'drizzle-orm';
import { expectPgError, PG } from '../../test/support/pg-error.js';
import { createTestDb, type TestDb } from '../../test/support/test-db.js';
import { auditLog } from './schema/index.js';

describe('audit_log (integration)', () => {
  let testDb: TestDb;
  let entryId: string;

  beforeAll(async () => {
    testDb = createTestDb();
    const [row] = await testDb.db
      .insert(auditLog)
      .values({
        action: 'test.created',
        objectType: 'test',
        before: null,
        after: { value: 1 },
      })
      .returning({ id: auditLog.id });
    entryId = row!.id;
  });

  afterAll(async () => {
    await testDb.close();
  });

  it('accepts new entries and reads them back', async () => {
    const [row] = await testDb.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.id, entryId));
    expect(row?.action).toBe('test.created');
    expect(row?.after).toEqual({ value: 1 });
  });

  it('rejects UPDATE', async () => {
    const code = await expectPgError(() =>
      testDb.db
        .update(auditLog)
        .set({ action: 'tampered' })
        .where(eq(auditLog.id, entryId)),
    );
    expect(code).toBe(PG.restrictViolation);
  });

  it('rejects DELETE', async () => {
    const code = await expectPgError(() =>
      testDb.db.delete(auditLog).where(eq(auditLog.id, entryId)),
    );
    expect(code).toBe(PG.restrictViolation);
  });

  it('rejects TRUNCATE', async () => {
    const code = await expectPgError(() =>
      testDb.db.execute(sql`truncate table app.audit_log`),
    );
    expect(code).toBe(PG.restrictViolation);
  });

  it('leaves the entry intact after the rejected attempts', async () => {
    const [row] = await testDb.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.id, entryId));
    expect(row?.action).toBe('test.created');
  });
});
