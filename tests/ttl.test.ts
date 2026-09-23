import { describe, it, expect, afterEach } from 'vitest';
import { createTestApp, sampleSiteZip } from './helpers.js';

describe('TTL → 410', () => {
  const cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  it('returns 410 for expired unclaimed sites', async () => {
    const ctx = await createTestApp({ ttlMs: 1_000 });
    cleanups.push(ctx.cleanup);

    const up = await ctx.app.request('/api/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/zip' },
      body: sampleSiteZip(),
    });
    const { siteId } = await up.json();

    const ok = await ctx.app.request(`/s/${siteId}/`);
    expect(ok.status).toBe(200);

    ctx.advance(1_001);

    const gone = await ctx.app.request(`/s/${siteId}/`);
    expect(gone.status).toBe(410);
  });
});
