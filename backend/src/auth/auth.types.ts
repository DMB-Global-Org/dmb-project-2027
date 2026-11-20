import type { Request, Response } from 'express';
import type { Actor } from '../authz/types.js';

/** The authenticated account of a request. */
export interface AuthContext {
  accountId: string;
  email: string;
  locale: string;
  /** Organization schema of the account; null for SuperAdministrators. */
  orgSchema: string | null;
  /** What the permission engine (`can`) needs to know about the account. */
  actor: Actor;
}

/** GraphQL context built per request (see AppModule). */
export interface GqlContext {
  req: Request;
  res: Response;
  /** Set by AuthGuard: the logged-in account, or null. */
  auth?: AuthContext | null;
  /** Session token of the request, when it carries a valid one. */
  sessionToken?: string | null;
  authResolved?: Promise<void>;
}

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}
