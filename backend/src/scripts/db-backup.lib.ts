// Pure helpers and thin wrappers around pg_dump / psql / zip, shared by
// db-backup.ts and db-restore.ts (see decision 90 in docs/ustalenia-i-kontekst.md).
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';

export const execFileAsync = promisify(execFile);

/** Backups live here (git-ignored); relative to the backend directory. */
export const BACKUP_DIR = '_backup';

/** Schemas owned by the application: never `auth`, `storage` etc. (Supabase). */
export function isOwnedSchema(name: string): boolean {
  return name === 'app' || name === 'drizzle' || name.startsWith('org_');
}

/** Short, file-name-safe label of the server a connection string points to. */
export function serverLabel(url: string): string {
  const u = new URL(url);
  const host = u.hostname.toLowerCase();
  const isLocal =
    host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const base = isLocal ? 'localhost' : host;
  // Supabase pooler user names look like `postgres.<project-ref>`.
  const ref = decodeURIComponent(u.username).split('.')[1];
  const parts = [base, u.port || '5432', ref, u.pathname.replace(/^\//, '')];
  return parts
    .filter(Boolean)
    .join('-')
    .replace(/[^a-z0-9._-]+/gi, '_');
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD_HH-MM-SS` in local time. */
export function timestamp(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
}

export function backupBaseName(
  url: string,
  date: Date,
  label?: string,
): string {
  return [serverLabel(url), label, timestamp(date)].filter(Boolean).join('_');
}

/** Arguments for a plain-SQL pg_dump of the given schemas (password via PGPASSWORD). */
export function pgDumpArgs(schemas: string[], outFile: string): string[] {
  return [
    '--format=plain',
    '--no-owner',
    '--no-privileges',
    '--clean',
    '--if-exists',
    ...schemas.map((s) => `--schema=${s}`),
    `--file=${outFile}`,
  ];
}

/** Connection string without the password, plus the password as environment. */
export function splitConnection(url: string): {
  conninfo: string;
  env: Record<string, string>;
} {
  const u = new URL(url);
  const env: Record<string, string> = {};
  if (u.password) env.PGPASSWORD = decodeURIComponent(u.password);
  u.password = '';
  return { conninfo: u.toString(), env };
}

const BREW_BIN = ['/opt/homebrew/opt/libpq/bin', '/usr/local/opt/libpq/bin'];

/** Finds pg_dump / psql in PATH or in the Homebrew libpq keg (not linked by default). */
export async function findPgTool(name: 'pg_dump' | 'psql'): Promise<string> {
  try {
    await execFileAsync(name, ['--version']);
    return name;
  } catch {
    // not in PATH
  }
  for (const dir of BREW_BIN) {
    const candidate = `${dir}/${name}`;
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    `${name} not found. Install the PostgreSQL client tools: brew install libpq ` +
      `(binaries land in ${BREW_BIN[0]}), version >= the server's.`,
  );
}

/** Local development database from docker-compose.yml (service postgres-dev). */
export const DEFAULT_LOCAL_URL =
  'postgres://postgres:postgres@localhost:5435/dmb_dev';

/**
 * Connection string for `--url-env=NAME`. DATABASE_URL_LOCAL falls back to the
 * docker-compose dev database, so the local database never needs backend/.env.
 */
export function resolveDbUrl(
  urlEnv: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const url =
    env[urlEnv] ?? (urlEnv === 'DATABASE_URL_LOCAL' ? DEFAULT_LOCAL_URL : '');
  if (!url) throw new Error(`${urlEnv} is not set`);
  return url;
}

/** SQL that drops the given application schemas (restore --wipe). */
export function wipeSql(schemas: string[]): string {
  return schemas
    .filter(isOwnedSchema)
    .map((s) => `DROP SCHEMA IF EXISTS "${s.replaceAll('"', '""')}" CASCADE;\n`)
    .join('');
}
