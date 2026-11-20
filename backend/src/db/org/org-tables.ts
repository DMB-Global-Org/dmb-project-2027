import {
  defineOrgTables,
  ORG_SCHEMA_NAME_PATTERN,
  type OrgTables,
} from './schema.js';

const cache = new Map<string, OrgTables>();

/** True for names the server generates for organization schemas. */
export function isOrgSchemaName(name: string): boolean {
  return ORG_SCHEMA_NAME_PATTERN.test(name);
}

export function assertOrgSchemaName(name: string): void {
  if (!isOrgSchemaName(name)) {
    throw new Error(`Invalid organization schema name: ${name}`);
  }
}

/**
 * Tables of one organization schema. The name is validated against the
 * generated format; whether the schema is registered is checked separately by
 * `OrgSchemaService.assertRegistered`.
 */
export function orgTables(schemaName: string): OrgTables {
  assertOrgSchemaName(schemaName);
  let tables = cache.get(schemaName);
  if (!tables) {
    tables = defineOrgTables(schemaName);
    cache.set(schemaName, tables);
  }
  return tables;
}
