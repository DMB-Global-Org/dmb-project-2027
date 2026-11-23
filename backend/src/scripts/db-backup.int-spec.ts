import { execFile } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createTestDb, type TestDb } from '../../test/support/test-db.js';
import { testDatabaseUrl } from '../../test/support/config.js';
import { BACKUP_DIR, findPgTool } from './db-backup.lib.js';

const run = promisify(execFile);
const hasTools = await findPgTool('pg_dump')
  .then(() => findPgTool('psql'))
  .then(() => true)
  .catch(() => false);

describe.skipIf(!hasTools)('db:backup and db:restore (integration)', () => {
  let testDb: TestDb;
  const url = testDatabaseUrl();
  const env = { ...process.env, DATABASE_URL_TEST: url };
  const before = new Set<string>();

  beforeAll(async () => {
    testDb = createTestDb();
    try {
      for (const f of readdirSync(BACKUP_DIR)) before.add(f);
    } catch {
      // no backup directory yet
    }
  });

  afterAll(async () => {
    await testDb.client.unsafe('drop schema if exists "org_bak00001" cascade');
    await testDb.close();
    try {
      for (const f of readdirSync(BACKUP_DIR)) {
        if (!before.has(f) && f.endsWith('.zip')) rmSync(join(BACKUP_DIR, f));
      }
    } catch {
      // nothing to clean
    }
  });

  it('restores app and org schemas after data was lost', async () => {
    const sql = testDb.client;
    await sql.unsafe('create schema "org_bak00001"');
    await sql.unsafe('create table "org_bak00001".marker (v text)');
    await sql.unsafe(`insert into "org_bak00001".marker values ('kept')`);

    await run(
      'pnpm',
      [
        'exec',
        'tsx',
        'src/scripts/db-backup.ts',
        '--url-env=DATABASE_URL_TEST',
      ],
      { env },
    );
    const zip = readdirSync(BACKUP_DIR).find(
      (f) => f.endsWith('.zip') && !before.has(f),
    );
    expect(zip).toBeDefined();

    await sql.unsafe(`update "org_bak00001".marker set v = 'lost'`);
    const u = new URL(url);
    const host = `${u.hostname}:${u.port}`;
    await run(
      'pnpm',
      [
        'exec',
        'tsx',
        'src/scripts/db-restore.ts',
        join(BACKUP_DIR, zip as string),
        '--url-env=DATABASE_URL_TEST',
        `--confirm-host=${host}`,
      ],
      { env },
    );

    const rows = await sql.unsafe('select v from "org_bak00001".marker');
    expect(rows.map((r) => r.v)).toEqual(['kept']);
  });

  it('--wipe also removes schemas created after the backup', async () => {
    const sql = testDb.client;
    await run(
      'pnpm',
      [
        'exec',
        'tsx',
        'src/scripts/db-backup.ts',
        '--url-env=DATABASE_URL_TEST',
      ],
      { env },
    );
    const zip = readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.zip') && !before.has(f))
      .sort()
      .at(-1) as string;

    await sql.unsafe('create schema "org_bak00002"');
    await sql.unsafe('create table "org_bak00002".t (v int)');
    const u = new URL(url);
    await run(
      'pnpm',
      [
        'exec',
        'tsx',
        'src/scripts/db-restore.ts',
        join(BACKUP_DIR, zip),
        '--wipe',
        '--url-env=DATABASE_URL_TEST',
        `--confirm-host=${u.hostname}:${u.port}`,
      ],
      { env },
    );

    const rows = await sql.unsafe(
      `select 1 from information_schema.schemata where schema_name = 'org_bak00002'`,
    );
    expect(rows).toHaveLength(0);
  });

  it('refuses to restore when the host is not confirmed', async () => {
    await expect(
      run(
        'pnpm',
        [
          'exec',
          'tsx',
          'src/scripts/db-restore.ts',
          '--url-env=DATABASE_URL_TEST',
          '--confirm-host=wrong-host',
        ],
        { env },
      ),
    ).rejects.toMatchObject({ code: 1 });
  });
});
