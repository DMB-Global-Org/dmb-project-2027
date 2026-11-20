import { readFileSync } from 'node:fs';
import { APP_VERSION } from './version.js';

describe('APP_VERSION', () => {
  it('is the version in backend/package.json', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
