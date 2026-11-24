// Pure helpers for `pnpm local <command>` (see local.ts and decision 91).
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { BACKUP_DIR } from './db-backup.lib.js';

/** Copies of production and local snapshots are kept apart. */
export const PROD_DIR = join(BACKUP_DIR, 'prod');
export const LOCAL_DIR = join(BACKUP_DIR, 'local');

/** The only host:port `pnpm local` is allowed to write to (docker-compose postgres-dev). */
export const LOCAL_HOST = 'localhost:5435';

export function hostPort(url: string): string {
  const u = new URL(url);
  return `${u.hostname === '127.0.0.1' ? 'localhost' : u.hostname}:${u.port || '5432'}`;
}

/** Throws unless the URL points to the local docker-compose dev database. */
export function assertLocalUrl(url: string): void {
  const target = hostPort(url);
  if (target !== LOCAL_HOST) {
    throw new Error(
      `Refusing to write to ${target}: pnpm local only touches ${LOCAL_HOST}.`,
    );
  }
}

/** A snapshot name that is safe in a file name. */
export function sanitizeName(name: string): string {
  const clean = name
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '_')
    .replace(/^_+|_+$/g, '');
  if (!clean) throw new Error(`Invalid snapshot name "${name}"`);
  return clean;
}

/**
 * Newest zip in `dir` (by modification time). With `name`, only snapshots made with
 * `--name=<name>`, i.e. files containing `_<name>_`.
 */
export function newestZip(dir: string, name?: string): string {
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    files = [];
  }
  const marker = name ? `_${sanitizeName(name)}_` : undefined;
  const zips = files
    .filter((f) => f.endsWith('.zip') && (!marker || f.includes(marker)))
    .map((f) => join(dir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  const newest = zips[0];
  if (!newest) {
    throw new Error(
      name
        ? `No snapshot "${name}" in ${dir}`
        : `No backups in ${dir}` +
            (dir === PROD_DIR ? ' (run: pnpm local pull)' : ''),
    );
  }
  return newest;
}

/**
 * Environment for create-superadmin against the local database. .env.superadmin holds
 * only the account variables (production settings live in .env.production.local and are
 * never read here); DATABASE_URL is forced to the local database regardless.
 */
export function superAdminEnv(
  fileContent: string,
  localUrl: string,
): Record<string, string> {
  assertLocalUrl(localUrl);
  const parsed = parseEnv(fileContent);
  const email = parsed.SUPERADMIN_EMAIL;
  const password = parsed.SUPERADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set in backend/.env.superadmin',
    );
  }
  return {
    SUPERADMIN_EMAIL: email,
    SUPERADMIN_PASSWORD: password,
    DATABASE_URL: localUrl,
  };
}

/** True when backend/.env.docker keeps mail in console mode (no real e-mail from a prod copy). */
export function mailDriverIsConsole(envDockerContent: string): boolean {
  return parseEnv(envDockerContent).MAIL_DRIVER === 'console';
}
