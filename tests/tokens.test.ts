import { describe, it, expect } from 'vitest';
import { generateClaimToken, hashClaimToken, generateSiteId } from '../src/core/tokens.js';

describe('tokens', () => {
  it('claim token is ≥128-bit hex and hashes stably', async () => {
    const t = generateClaimToken();
    expect(t).toMatch(/^[0-9a-f]{32}$/);
    const h = await hashClaimToken(t);
    expect(h).toHaveLength(64);
    expect(await hashClaimToken(t)).toBe(h);
    expect(await hashClaimToken(t)).not.toBe(await hashClaimToken(t + 'x'));
  });

  it('site ids are unique-ish nanoids', () => {
    const a = generateSiteId();
    const b = generateSiteId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(10);
  });
});
