import { describe, it, expect, afterEach } from 'vitest';
import { createTestApp, sampleSiteZip, claimTokenFromUrl } from './helpers.js';

describe('claim one-shot', () => {
  const cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  it('claims once then rejects the same token', async () => {
    const ctx = await createTestApp();
    cleanups.push(ctx.cleanup);

    const up = await ctx.app.request('/api/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/zip' },
      body: sampleSiteZip(),
    });
    expect(up.status).toBe(200);
    const body = await up.json();
    const token = claimTokenFromUrl(body.claimUrl);

    const claim1 = await ctx.app.request(`/api/claim/${token}`, { method: 'POST' });
    expect(claim1.status).toBe(200);
    const claimed = await claim1.json();
    expect(claimed.claimed).toBe(true);
    expect(claimed.siteId).toBe(body.siteId);

    const meta = await ctx.meta.get(body.siteId);
    expect(meta?.claimed).toBe(true);
    expect(meta?.expiresAt).toBeNull();

    const claim2 = await ctx.app.request(`/api/claim/${token}`, { method: 'POST' });
    expect(claim2.status).toBe(404);
  });
});
