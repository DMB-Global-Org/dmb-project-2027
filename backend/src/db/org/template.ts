// Entry point for `drizzle-kit` (drizzle.org.config.ts): the organization
// tables bound to the template schema. Not used at runtime.
import { defineOrgTables, ORG_TEMPLATE_SCHEMA } from './schema.js';

const template = defineOrgTables(ORG_TEMPLATE_SCHEMA);

export const partners = template.partners;
export const roleHistory = template.roleHistory;
