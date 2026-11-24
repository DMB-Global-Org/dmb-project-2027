import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertLocalUrl,
  hostPort,
  mailDriverIsConsole,
  newestZip,
  sanitizeName,
  superAdminEnv,
} from './local.lib.js';

const LOCAL = 'postgres://postgres:postgres@localhost:5435/dmb_dev';
const PROD =
  'postgresql://postgres.ref:pw@aws-0-eu.pooler.supabase.com:5432/postgres';

describe('pnpm local helpers', () => {
  it('normalizes host and port', () => {
    expect(hostPort(LOCAL)).toBe('localhost:5435');
    expect(hostPort('postgres://u:p@127.0.0.1:5435/x')).toBe('localhost:5435');
    expect(hostPort('postgres://u:p@db.example.com/x')).toBe(
      'db.example.com:5432',
    );
  });

  it('accepts only the docker-compose dev database', () => {
    expect(() => assertLocalUrl(LOCAL)).not.toThrow();
    expect(() => assertLocalUrl(PROD)).toThrow(/Refusing/);
    expect(() =>
      assertLocalUrl('postgres://postgres:postgres@localhost:5434/dmb_test'),
    ).toThrow(/Refusing/);
  });

  it('sanitizes snapshot names', () => {
    expect(sanitizeName(' przed testem ')).toBe('przed_testem');
    expect(sanitizeName('a/../b')).toBe('a_.._b');
    expect(() => sanitizeName('  ')).toThrow();
  });

  describe('newestZip', () => {
    let dir: string;
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'local-lib-'));
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    const make = (name: string, secondsAgo: number) => {
      const f = join(dir, name);
      writeFileSync(f, '');
      const t = new Date(Date.now() - secondsAgo * 1000);
      utimesSync(f, t, t);
      return f;
    };

    it('picks the newest zip and ignores other files', () => {
      make('old.zip', 100);
      const newest = make('new.zip', 10);
      make('newer.txt', 1);
      expect(newestZip(dir)).toBe(newest);
    });

    it('picks the newest snapshot with a given name', () => {
      make('localhost-5435-dmb_dev_a_2026-11-24_10-00-00.zip', 300);
      const wanted = make(
        'localhost-5435-dmb_dev_a_2026-11-24_11-00-00.zip',
        200,
      );
      make('localhost-5435-dmb_dev_b_2026-11-24_12-00-00.zip', 100);
      expect(newestZip(dir, 'a')).toBe(wanted);
    });

    it('fails clearly when nothing matches or the directory is missing', () => {
      expect(() => newestZip(dir)).toThrow(/No backups/);
      expect(() => newestZip(dir, 'x')).toThrow(/No snapshot "x"/);
      expect(() => newestZip(join(dir, 'missing'))).toThrow(/No backups/);
    });
  });

  describe('superAdminEnv', () => {
    const file = `DATABASE_URL="${PROD}"\nSUPERADMIN_EMAIL=a@b.pl\nSUPERADMIN_PASSWORD="s3cret pass"\nMAILERSEND_API_KEY=key\n`;

    it('forces the local database and passes only the account variables', () => {
      expect(superAdminEnv(file, LOCAL)).toEqual({
        SUPERADMIN_EMAIL: 'a@b.pl',
        SUPERADMIN_PASSWORD: 's3cret pass',
        DATABASE_URL: LOCAL,
      });
    });

    it('rejects a non-local target and missing credentials', () => {
      expect(() => superAdminEnv(file, PROD)).toThrow(/Refusing/);
      expect(() => superAdminEnv('SUPERADMIN_EMAIL=a@b.pl', LOCAL)).toThrow(
        /must be set/,
      );
    });
  });

  it('requires MAIL_DRIVER=console in .env.docker', () => {
    expect(mailDriverIsConsole('MAIL_DRIVER=console\n')).toBe(true);
    expect(mailDriverIsConsole('MAIL_DRIVER=mailersend\n')).toBe(false);
    expect(mailDriverIsConsole('PORT=8000\n')).toBe(false);
  });
});
