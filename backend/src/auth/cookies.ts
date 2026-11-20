import type { Request } from 'express';
import type { RequestMeta } from './auth.types.js';

export function parseCookies(
  header: string | undefined,
): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (!name || name in cookies) continue;
    const raw = part.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(raw);
    } catch {
      cookies[name] = raw;
    }
  }
  return cookies;
}

export function requestMeta(req: Request): RequestMeta {
  return {
    ip: req.ip ?? req.socket.remoteAddress ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}
