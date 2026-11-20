import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export const MIN_PASSWORD_LENGTH = 10;
// Upper bound so a huge "password" cannot be used to burn CPU.
export const MAX_PASSWORD_LENGTH = 128;

interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

// ~100 ms and 32 MiB per hash on a typical server.
const DEFAULT_PARAMS: ScryptParams = { N: 2 ** 15, r: 8, p: 1 };
const KEY_LENGTH = 64;
// Parameters are read from the stored hash: refuse absurd ones.
const MAX_N = 2 ** 20;

function derive(
  password: string,
  salt: Buffer,
  { N, r, p }: ScryptParams,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      { N, r, p, maxmem: 128 * N * r * 2 + 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

/** Format: `scrypt$N$r$p$<salt base64>$<key base64>`. */
export async function hashPassword(
  password: string,
  params: ScryptParams = DEFAULT_PARAMS,
): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, params);
  return [
    'scrypt',
    params.N,
    params.r,
    params.p,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  const valid =
    Number.isInteger(params.N) &&
    params.N > 1 &&
    params.N <= MAX_N &&
    (params.N & (params.N - 1)) === 0 &&
    Number.isInteger(params.r) &&
    params.r > 0 &&
    Number.isInteger(params.p) &&
    params.p > 0;
  if (!valid || !saltB64 || !keyB64) return false;

  const expected = Buffer.from(keyB64, 'base64');
  const actual = await derive(password, Buffer.from(saltB64, 'base64'), params);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

let dummyHash: Promise<string> | undefined;

/**
 * Spends the same time as a real check. Used when the e-mail is unknown, so a
 * response time does not reveal which e-mails have accounts.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  await verifyPassword(password, await dummyHash);
  return false;
}

export type PasswordProblem = 'too_short' | 'too_long';

export function checkPasswordStrength(
  password: string,
): PasswordProblem | null {
  if (password.length < MIN_PASSWORD_LENGTH) return 'too_short';
  if (password.length > MAX_PASSWORD_LENGTH) return 'too_long';
  return null;
}
