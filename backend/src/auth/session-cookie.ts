import { Inject, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';

/** Sets and clears the session cookie; used by every operation that logs in. */
@Injectable()
export class SessionCookie {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  set(res: Response, token: string, expiresAt: Date): void {
    res.cookie(this.config.cookieName, token, {
      ...this.options(),
      expires: expiresAt,
    });
  }

  clear(res: Response): void {
    res.clearCookie(this.config.cookieName, this.options());
  }

  private options() {
    return {
      httpOnly: true,
      secure: this.config.secureCookie,
      sameSite: 'lax' as const,
      path: '/',
    };
  }
}
