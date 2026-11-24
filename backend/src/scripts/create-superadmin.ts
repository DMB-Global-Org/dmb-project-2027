// Creates the SuperAdministrator account (run once after the first deploy):
//   SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... pnpm --filter backend create-superadmin
// Add --reset-password to set a new password for an existing account.
// Without putting the password in the shell history (production from this machine):
// backend/.env.superadmin holds only SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD, and
// backend/.env.production.local holds DATABASE_URL, MAIL_FROM_EMAIL and MAILERSEND_API_KEY
// (both git-ignored). Run `pnpm --filter backend create-superadmin:file`.
// Variables from these files win over backend/.env.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ensureSuperAdmin } from '../auth/superadmin.js';
import * as schema from '../db/schema/index.js';

// Locally read backend/.env; on Render the variables come from the environment.
try {
  process.loadEnvFile();
} catch {
  // no .env file
}

const url = process.env.DATABASE_URL;
const email = process.env.SUPERADMIN_EMAIL;
const password = process.env.SUPERADMIN_PASSWORD;
if (!url) throw new Error('DATABASE_URL is not set');
if (!email || !password) {
  throw new Error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be set');
}

const client = postgres(url, { max: 1, prepare: false });
try {
  const result = await ensureSuperAdmin(drizzle(client, { schema }), {
    email,
    password,
    resetPassword: process.argv.includes('--reset-password'),
  });
  console.log(`SuperAdministrator ${email}: ${result}`);
} finally {
  await client.end({ timeout: 5 });
}
