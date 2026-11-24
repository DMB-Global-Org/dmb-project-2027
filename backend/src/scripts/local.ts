// One entry point for the local database (decision 91):
//   pnpm local <command> [name]
// Everything runs against docker-compose postgres-dev (localhost:5435); production is
// only ever read (pg_dump) by `pull`. Backend and frontend are started separately.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import postgres from 'postgres';
import { isOwnedSchema, resolveDbUrl, wipeSql } from './db-backup.lib.js';
import {
  LOCAL_DIR,
  LOCAL_HOST,
  PROD_DIR,
  assertLocalUrl,
  mailDriverIsConsole,
  newestZip,
  sanitizeName,
  superAdminEnv,
} from './local.lib.js';

const COMPOSE = ['compose', '-f', '../docker-compose.yml'];

function run(
  cmd: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${cmd} ${args[0]} exited with ${code}`)),
    );
  });
}

const tsx = (script: string, args: string[], env?: Record<string, string>) =>
  run('pnpm', ['exec', 'tsx', `src/scripts/${script}`, ...args], env);

const localUrl = () => {
  const url = resolveDbUrl('DATABASE_URL_LOCAL');
  assertLocalUrl(url);
  return url;
};

/** .env.docker must exist and keep mail in console mode (a copy of production has real addresses). */
function guardEnvDocker(): void {
  let content: string;
  try {
    content = readFileSync('.env.docker', 'utf8');
  } catch {
    throw new Error(
      'backend/.env.docker is missing: cp backend/.env.docker.example backend/.env.docker',
    );
  }
  if (!mailDriverIsConsole(content)) {
    throw new Error('backend/.env.docker must have MAIL_DRIVER=console');
  }
}

async function withLocalDb<T>(
  fn: (sql: postgres.Sql) => Promise<T>,
): Promise<T> {
  const sql = postgres(localUrl(), {
    max: 1,
    prepare: false,
    onnotice: () => {},
  });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function hasAppSchema(): Promise<boolean> {
  return withLocalDb(async (sql) => {
    const rows =
      await sql`select 1 from information_schema.schemata where schema_name = 'app'`;
    return rows.length > 0;
  });
}

async function wipeLocal(): Promise<void> {
  await withLocalDb(async (sql) => {
    const rows = await sql<{ schema_name: string }[]>`
      select schema_name from information_schema.schemata`;
    await sql.unsafe(
      wipeSql(rows.map((r) => r.schema_name).filter(isOwnedSchema)),
    );
  });
}

const restoreFile = (zip: string) =>
  tsx('db-restore.ts', [
    zip,
    '--url-env=DATABASE_URL_LOCAL',
    '--wipe',
    `--confirm-host=${LOCAL_HOST}`,
  ]);

const migrate = () => run('pnpm', ['run', 'db:migrate:all:local']);

async function ensureSuperAdmin(): Promise<void> {
  const env = superAdminEnv(
    readFileSync('.env.superadmin', 'utf8'),
    localUrl(),
  );
  await tsx('create-superadmin.ts', [], env);
}

async function pull(): Promise<void> {
  mkdirSync(PROD_DIR, { recursive: true });
  // Production is only read here (pg_dump over DATABASE_DIRECT_URL from backend/.env).
  await tsx('db-backup.ts', [`--out-dir=${PROD_DIR}`]);
  await restoreFile(newestZip(PROD_DIR));
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(`${question} (yes/no): `)).trim() === 'yes';
  } finally {
    rl.close();
  }
}

const commands: Record<string, (name?: string) => Promise<void>> = {
  async up() {
    guardEnvDocker();
    await run('docker', [...COMPOSE, 'up', '-d', '--wait', 'postgres-dev']);
    if (await hasAppSchema()) {
      console.log(
        'Local database already has data; use "pull" to refresh it from production.',
      );
    } else {
      await pull();
    }
  },
  async pull() {
    guardEnvDocker();
    localUrl();
    await pull();
  },
  async snap(name) {
    guardEnvDocker();
    localUrl();
    mkdirSync(LOCAL_DIR, { recursive: true });
    await tsx('db-backup.ts', [
      '--url-env=DATABASE_URL_LOCAL',
      `--out-dir=${LOCAL_DIR}`,
      ...(name ? [`--name=${sanitizeName(name)}`] : []),
    ]);
  },
  async restore(name) {
    guardEnvDocker();
    localUrl();
    await restoreFile(newestZip(LOCAL_DIR, name));
  },
  async reset() {
    guardEnvDocker();
    localUrl();
    await restoreFile(newestZip(PROD_DIR));
  },
  async migrate() {
    guardEnvDocker();
    localUrl();
    await migrate();
  },
  async empty() {
    guardEnvDocker();
    localUrl();
    // Fail before wiping when the account data is missing.
    superAdminEnv(readFileSync('.env.superadmin', 'utf8'), localUrl());
    await wipeLocal();
    await migrate();
    await ensureSuperAdmin();
  },
  async down() {
    await run('docker', [...COMPOSE, 'stop', 'postgres-dev']);
  },
  async nuke() {
    if (
      !(await confirm(
        'Remove the local database volume AND all copies in _backup/prod and _backup/local?',
      ))
    ) {
      console.log('Nothing was changed.');
      return;
    }
    await run('docker', [...COMPOSE, 'down', '-v']);
    rmSync(PROD_DIR, { recursive: true, force: true });
    rmSync(LOCAL_DIR, { recursive: true, force: true });
  },
};

const [command, name] = process.argv.slice(2);
const handler = command ? commands[command] : undefined;
if (!handler) {
  console.error(
    `Usage: pnpm local <${Object.keys(commands).join('|')}> [snapshot-name]\n` +
      '  up       start Docker; pull production if the local database is empty\n' +
      '  pull     download production and load it locally (replaces local data)\n' +
      '  snap     snapshot of the local database [name]\n' +
      '  restore  return to a snapshot [name; default: the latest]\n' +
      '  reset    return to the last copy of production\n' +
      '  migrate  apply migrations of this branch to the local database\n' +
      '  empty    structure without data + SuperAdministrator from .env.superadmin\n' +
      '  down     stop the container (data stays)\n' +
      '  nuke     remove the volume and all copies from disk',
  );
  process.exit(1);
}
try {
  await handler(name);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
