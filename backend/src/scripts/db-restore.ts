// Restore from a backup made by db-backup:
//   pnpm --filter backend db:restore [path/to/backup.zip] [--url-env=NAME] [--confirm-host=HOST] [--no-transaction]
// Without a path the newest zip in backend/_backup/ is used. The target is
// DATABASE_DIRECT_URL unless --url-env picks another variable (e.g. DATABASE_URL_TEST).
// The dump DROPs and recreates every table it contains, so the target host must be
// confirmed: type it when asked or pass --confirm-host. Runs in ONE transaction:
// any error leaves the database untouched.
import { spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { BACKUP_DIR, findPgTool, splitConnection } from './db-backup.lib.js';

try {
  process.loadEnvFile();
} catch {
  // no .env file
}

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const urlEnv = arg('url-env') ?? 'DATABASE_DIRECT_URL';
const url = process.env[urlEnv];
if (!url) throw new Error(`${urlEnv} is not set`);

function newestBackup(): string {
  const zips = readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.zip'))
    .map((f) => join(BACKUP_DIR, f));
  const newest = zips.sort(
    (a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs,
  )[0];
  if (!newest) throw new Error(`No backups in ${BACKUP_DIR}`);
  return newest;
}

const zipFile =
  process.argv.slice(2).find((a) => !a.startsWith('--')) ?? newestBackup();
const target = new URL(url);
const host = target.hostname;

console.log(`Backup: ${zipFile}`);
console.log(
  `Target: ${host}:${target.port || 5432}${target.pathname} (${urlEnv})`,
);
console.log('This DROPs and recreates all tables contained in the backup.');

const confirmed =
  arg('confirm-host') ??
  (await (async () => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      return await rl.question(`Type the target host (${host}) to continue: `);
    } finally {
      rl.close();
    }
  })());
if (confirmed !== host) {
  console.error('Host does not match, nothing was changed.');
  process.exit(1);
}

const psql = await findPgTool('psql');
const { conninfo, env } = splitConnection(url);

// unzip -p streams the SQL straight into psql; no plaintext file lands on disk.
const unzip = spawn('unzip', ['-p', zipFile], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
const client = spawn(
  psql,
  [
    '-v',
    'ON_ERROR_STOP=1',
    '--single-transaction',
    '--quiet',
    '-f',
    '-',
    conninfo,
  ],
  { stdio: ['pipe', 'inherit', 'inherit'], env: { ...process.env, ...env } },
);
// psql may exit early on an error; do not crash on the broken pipe.
client.stdin.on('error', () => {});
unzip.stdout.pipe(client.stdin);

const [unzipCode, psqlCode] = await Promise.all(
  [unzip, client].map(
    (p) => new Promise<number | null>((resolve) => p.on('close', resolve)),
  ),
);
if (unzipCode !== 0 || psqlCode !== 0) {
  console.error(
    'Restore failed' +
      (process.argv.includes('--no-transaction')
        ? ': the database may be partially restored.'
        : '; the transaction was rolled back. If the error was "out of shared memory", ' +
          'raise max_locks_per_transaction on the server (many org_* tables), or use ' +
          '--no-transaction (not atomic).'),
  );
  process.exit(1);
}
console.log('Restore finished.');
