import {
  backupBaseName,
  isOwnedSchema,
  pgDumpArgs,
  serverLabel,
  splitConnection,
  timestamp,
} from './db-backup.lib.js';

describe('db-backup helpers', () => {
  it('labels a Supabase server with host, port and project ref', () => {
    expect(
      serverLabel(
        'postgresql://postgres.abcdef:pw@aws-0-eu.pooler.supabase.com:5432/postgres',
      ),
    ).toBe('aws-0-eu.pooler.supabase.com-5432-abcdef-postgres');
  });

  it('labels a local server', () => {
    expect(
      serverLabel('postgres://postgres:postgres@localhost:5434/dmb_test'),
    ).toBe('localhost-5434-dmb_test');
  });

  it('formats the timestamp as YYYY-MM-DD_HH-MM-SS', () => {
    expect(timestamp(new Date(2026, 10, 23, 7, 5, 9))).toBe(
      '2026-11-23_07-05-09',
    );
  });

  it('puts server, date and time in the file name', () => {
    const name = backupBaseName(
      'postgres://u:p@localhost:5434/dmb_test',
      new Date(2026, 10, 23, 14, 30, 0),
    );
    expect(name).toBe('localhost-5434-dmb_test_2026-11-23_14-30-00');
  });

  it('keeps only schemas owned by the application', () => {
    const names = [
      'app',
      'drizzle',
      'org_ab12cd34',
      'auth',
      'storage',
      'public',
      'organic',
    ];
    expect(names.filter(isOwnedSchema)).toEqual([
      'app',
      'drizzle',
      'org_ab12cd34',
    ]);
  });

  it('builds pg_dump arguments with one --schema per schema', () => {
    const args = pgDumpArgs(['app', 'org_x'], 'out.sql');
    expect(args).toContain('--schema=app');
    expect(args).toContain('--schema=org_x');
    expect(args).toContain('--file=out.sql');
    expect(args).toContain('--no-owner');
  });

  it('moves the password out of the connection string', () => {
    const { conninfo, env } = splitConnection('postgres://u:p%40ss@h:5432/db');
    expect(conninfo).not.toContain('p%40ss');
    expect(env.PGPASSWORD).toBe('p@ss');
  });
});
