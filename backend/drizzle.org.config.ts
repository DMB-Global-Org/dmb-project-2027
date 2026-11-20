import { defineConfig } from 'drizzle-kit';

// Migrations for the tables that exist once per Platinum organization.
// Only `generate` is used: the files are applied by our own runner
// (src/db/org-migrator), which replaces "org_template" with the real schema
// name. Never run `drizzle-kit migrate` with this config.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/org/template.ts',
  out: './drizzle-org',
  schemaFilter: ['org_template'],
  strict: true,
  verbose: true,
});
