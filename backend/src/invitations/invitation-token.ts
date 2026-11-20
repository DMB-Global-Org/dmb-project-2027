import { createHash, randomBytes } from 'node:crypto';

export const INVITATION_TTL_MS = 72 * 60 * 60 * 1000; // decision 75

/** An unguessable link token (256 bits). Only its hash is stored. */
export function newInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
