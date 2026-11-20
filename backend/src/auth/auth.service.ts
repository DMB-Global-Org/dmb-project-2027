import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';
import { appError } from '../common/graphql-error.js';
import { DB, type Database } from '../db/database.tokens.js';
import { accounts } from '../db/schema/index.js';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import type { AuthContext, RequestMeta } from './auth.types.js';
import { parseCookies } from './cookies.js';
import { ActorService } from './actor.service.js';
import { LOGIN_LIMITS, LoginThrottle } from './login-throttle.js';
import { verifyAgainstDummy, verifyPassword } from './password.js';
import { SessionService } from './session.service.js';

export interface LoginResult {
  auth: AuthContext;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    private readonly sessions: SessionService,
    private readonly actors: ActorService,
    private readonly throttle: LoginThrottle,
  ) {}

  async login(
    emailInput: string,
    password: string,
    meta: RequestMeta,
    now = new Date(),
  ): Promise<LoginResult> {
    const email = emailInput.trim().toLowerCase();
    const emailKey = `email:${email}`;
    const ipKey = `ip:${meta.ip ?? 'unknown'}`;

    if (
      this.throttle.isBlocked(emailKey, LOGIN_LIMITS.perEmail, now.getTime()) ||
      this.throttle.isBlocked(ipKey, LOGIN_LIMITS.perIp, now.getTime())
    ) {
      throw appError('TOO_MANY_ATTEMPTS');
    }

    const [account] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.email, email));

    // Always verify something, so timing does not reveal unknown e-mails.
    const passwordOk = account?.passwordHash
      ? await verifyPassword(password, account.passwordHash)
      : await verifyAgainstDummy(password);

    const auth =
      account && passwordOk ? await this.actors.load(account.id) : null;
    if (!account || !passwordOk || !auth) {
      this.throttle.recordFailure(emailKey, now.getTime());
      this.throttle.recordFailure(ipKey, now.getTime());
      throw appError('INVALID_CREDENTIALS');
    }

    // The password was right, so telling the state reveals nothing.
    if (auth.actor.state === 'DEACTIVATED')
      throw appError('ACCOUNT_DEACTIVATED');

    this.throttle.reset(emailKey);
    const session = await this.sessions.create(account.id, meta, now);
    return { auth, token: session.token, expiresAt: session.expiresAt };
  }

  /** The account behind the session cookie of a request, or null. */
  async authenticate(
    req: Request,
  ): Promise<{ auth: AuthContext; token: string } | null> {
    const token = parseCookies(req.headers.cookie)[this.config.cookieName];
    if (!token) return null;

    const session = await this.sessions.resolve(token);
    if (!session) return null;

    const auth = await this.actors.load(session.accountId);
    // A deactivated account is cut off even if one of its sessions survived.
    if (!auth || auth.actor.state === 'DEACTIVATED') return null;
    return { auth, token };
  }

  async logout(token: string): Promise<void> {
    await this.sessions.revoke(token);
  }
}
