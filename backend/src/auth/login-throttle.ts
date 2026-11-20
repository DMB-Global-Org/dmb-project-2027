import { Injectable } from '@nestjs/common';

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LIMITS = { perEmail: 5, perIp: 30 } as const;

interface Attempt {
  failures: number;
  resetAt: number;
}

/**
 * Brute-force protection for login: counts failures per key (an e-mail or an
 * IP) in a fixed window. In memory, which is enough for one instance; with
 * several instances each would count on its own.
 */
@Injectable()
export class LoginThrottle {
  private readonly attempts = new Map<string, Attempt>();

  isBlocked(key: string, limit: number, now = Date.now()): boolean {
    const attempt = this.attempts.get(key);
    if (!attempt) return false;
    if (attempt.resetAt <= now) {
      this.attempts.delete(key);
      return false;
    }
    return attempt.failures >= limit;
  }

  recordFailure(key: string, now = Date.now()): void {
    this.purge(now);
    const attempt = this.attempts.get(key);
    if (!attempt || attempt.resetAt <= now) {
      this.attempts.set(key, { failures: 1, resetAt: now + LOGIN_WINDOW_MS });
    } else {
      attempt.failures += 1;
    }
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  /** Keeps the map from growing without bound. */
  private purge(now: number): void {
    if (this.attempts.size < 1000) return;
    for (const [key, attempt] of this.attempts) {
      if (attempt.resetAt <= now) this.attempts.delete(key);
    }
  }
}
