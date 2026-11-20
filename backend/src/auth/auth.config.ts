import type { Env } from '../config/env.js';

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

export interface AuthConfig {
  sessionTtlDays: number;
  cookieName: string;
  /** Sent only over HTTPS; off in development so http://localhost works. */
  secureCookie: boolean;
}

export function authConfigFrom(
  env: Pick<Env, 'NODE_ENV' | 'SESSION_TTL_DAYS'>,
): AuthConfig {
  const production = env.NODE_ENV === 'production';
  return {
    sessionTtlDays: env.SESSION_TTL_DAYS,
    // The __Host- prefix makes browsers reject the cookie unless it is Secure,
    // has Path=/ and no Domain, so it cannot be planted from a sibling domain.
    cookieName: production ? '__Host-sid' : 'sid',
    secureCookie: production,
  };
}
