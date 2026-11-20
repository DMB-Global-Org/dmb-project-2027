import {
  checkPasswordStrength,
  hashPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  verifyAgainstDummy,
  verifyPassword,
} from './password.js';

// Cheap parameters keep the tests fast; production uses the default cost.
const CHEAP = { N: 1024, r: 8, p: 1 };

describe('passwords', () => {
  it('stores a self-describing scrypt hash, never the password', async () => {
    const hash = await hashPassword('correct horse battery', CHEAP);
    const [scheme, n, r, p, salt, key] = hash.split('$');

    expect([scheme, n, r, p]).toEqual(['scrypt', '1024', '8', '1']);
    expect(salt).toBeTruthy();
    expect(key).toBeTruthy();
    expect(hash).not.toContain('correct horse battery');
  });

  it('accepts the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery', CHEAP);

    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('correct horse batterz', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('salts every hash differently', async () => {
    const a = await hashPassword('same password here', CHEAP);
    const b = await hashPassword('same password here', CHEAP);

    expect(a).not.toBe(b);
    expect(await verifyPassword('same password here', a)).toBe(true);
    expect(await verifyPassword('same password here', b)).toBe(true);
  });

  it('treats canonically equivalent Unicode as the same password', async () => {
    const hash = await hashPassword('café au lait!', CHEAP);
    expect(await verifyPassword('café au lait!', hash)).toBe(true);
  });

  it('verifies with the parameters stored in the hash', async () => {
    const hash = await hashPassword('another password', {
      N: 2048,
      r: 8,
      p: 1,
    });
    expect(await verifyPassword('another password', hash)).toBe(true);
  });

  it.each([
    '',
    'plain text',
    'bcrypt$10$salt$key',
    'scrypt$1024$8$1$onlyfive',
    'scrypt$abc$8$1$c2FsdA==$a2V5',
    'scrypt$1000$8$1$c2FsdA==$a2V5', // N is not a power of two
    'scrypt$1024$0$1$c2FsdA==$a2V5',
    'scrypt$1024$8$1$$',
  ])('rejects the malformed hash %j instead of throwing', async (stored) => {
    expect(await verifyPassword('whatever password', stored)).toBe(false);
  });

  it('refuses a hash that asks for absurd work', async () => {
    const started = Date.now();
    const stored = `scrypt$${2 ** 30}$8$1$c2FsdA==$a2V5`;

    expect(await verifyPassword('whatever password', stored)).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('spends time on a dummy check and always says no', async () => {
    expect(await verifyAgainstDummy('anything at all')).toBe(false);
  });

  describe('strength', () => {
    it('requires a minimum length', () => {
      expect(checkPasswordStrength('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe(
        'too_short',
      );
      expect(checkPasswordStrength('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
    });

    it('caps the length so nobody can burn CPU with a huge password', () => {
      expect(checkPasswordStrength('a'.repeat(MAX_PASSWORD_LENGTH))).toBeNull();
      expect(checkPasswordStrength('a'.repeat(MAX_PASSWORD_LENGTH + 1))).toBe(
        'too_long',
      );
    });
  });
});
