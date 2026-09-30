import { nanoid } from 'nanoid';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** ≥128-bit claim token (32 hex chars = 128 bits). Uses Web Crypto (Workers + Node 20+). */
export function generateClaimToken(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
}

/** SHA-256 hex digest of the claim token (Web Crypto SubtleCrypto). */
export async function hashClaimToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

export function generateSiteId(): string {
  return nanoid(12);
}
