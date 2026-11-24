// Manual database backup: `pnpm --filter backend db:backup`
// Dumps the application schemas (app, drizzle, org_*) with pg_dump and packs the
// SQL into backend/_backup/<server>_<YYYY-MM-DD>_<HH-MM-SS>.zip (git-ignored).
// Uses DATABASE_DIRECT_URL (port 5432); `--url-env=NAME` picks another variable.
// Options: --out-dir=DIR, --name=LABEL (used by `pnpm local snap`).
// The backup contains personal data: keep it local, never commit or e-mail it.
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import {
  BACKUP_DIR,
  backupBaseName,
  execFileAsync,
  findPgTool,
  isOwnedSchema,
  pgDumpArgs,
  resolveDbUrl,
  splitConnection,
} from './db-backup.lib.js';

try {
  process.loadEnvFile();
} catch {
  // no .env file
}

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const urlEnv =
  process.argv
    .find((a) => a.startsWith('--url-env='))
    ?.slice('--url-env='.length) ?? 'DATABASE_DIRECT_URL';
const url = resolveDbUrl(urlEnv);

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
let schemas: string[];
try {
  const rows = await sql<{ schema_name: string }[]>`
    select schema_name from information_schema.schemata order by schema_name`;
  schemas = rows.map((r) => r.schema_name).filter(isOwnedSchema);
} finally {
  await sql.end({ timeout: 5 });
}
if (!schemas.includes('app')) throw new Error('Schema "app" not found');

const pgDump = await findPgTool('pg_dump');
// --out-dir=DIR puts the zip elsewhere than _backup/; --name=LABEL adds a label to the file name.
const outDir = arg('out-dir') ?? BACKUP_DIR;
const base = backupBaseName(url, new Date(), arg('name'));
const tmpDir = join(outDir, '.tmp');
mkdirSync(tmpDir, { recursive: true });
const sqlFile = join(tmpDir, `${base}.sql`);
const zipFile = join(outDir, `${base}.zip`);

try {
  const { conninfo, env } = splitConnection(url);
  await execFileAsync(pgDump, [...pgDumpArgs(schemas, sqlFile), conninfo], {
    env: { ...process.env, ...env },
  });
  await execFileAsync('zip', ['-j', '-q', zipFile, sqlFile]);
} finally {
  rmSync(sqlFile, { force: true });
}

const mb = (statSync(zipFile).size / 1024 / 1024).toFixed(2);
console.log(`Backup: ${zipFile} (${mb} MB)`);
console.log(`Schemas: ${schemas.join(', ')}`);
