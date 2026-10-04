import { defineConfig } from 'drizzle-kit';

// Locally read backend/.env; in CI/CD the variable comes from the environment.
try {
  process.loadEnvFile();
} catch {
  // no .env file
}

const url = process.env.DATABASE_DIRECT_URL;
if (!url) throw new Error('DATABASE_DIRECT_URL is not set');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  // Migrations need a session-level connection (direct or session pooler, port 5432).
  dbCredentials: { url },
  // Manage only our own schemas – never Supabase's (auth, storage, ...).
  schemaFilter: ['app'],
  strict: true,
  verbose: true,
});
