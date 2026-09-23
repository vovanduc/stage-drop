import { createHash, randomBytes } from 'node:crypto';
import { nanoid } from 'nanoid';

/** ≥128-bit claim token (32 hex chars = 128 bits). */
export function generateClaimToken(): string {
  return randomBytes(16).toString('hex');
}

export function hashClaimToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function generateSiteId(): string {
  return nanoid(12);
}
