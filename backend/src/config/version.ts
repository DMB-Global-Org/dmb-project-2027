import { readFileSync } from 'node:fs';

/**
 * Version of the running backend, read from its package.json. From `src/config`
 * and from the built `dist/config` the file is two levels up.
 */
export const APP_VERSION: string = (
  JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  ) as { version: string }
).version;
