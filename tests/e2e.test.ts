import { describe, it, expect, afterEach } from 'vitest';
import { createTestApp, sampleSiteZip, claimTokenFromUrl } from './helpers.js';
import { sweepExpired } from '../src/core/app.js';

describe('E2E upload → serve → claim / expire', () => {
  const cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  it('claimed site survives TTL sweep', async () => {
    const ctx = await createTestApp({ ttlMs: 5_000 });
    cleanups.push(ctx.cleanup);

    const up = await ctx.app.request('/api/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/zip' },
      body: sampleSiteZip(),
    });
    expect(up.status).toBe(200);
    const body = await up.json();
    const token = claimTokenFromUrl(body.claimUrl);

    const live = await ctx.app.request(`/s/${body.siteId}/`);
    expect(live.status).toBe(200);
    const html = await live.text();
    expect(html).toContain('Hello stage-drop');

    const claim = await ctx.app.request(`/api/claim/${token}`, { method: 'POST' });
    expect(claim.status).toBe(200);

    ctx.advance(10_000);
    const removed = await sweepExpired(ctx.blob, ctx.meta, ctx.getNow());
    expect(removed).not.toContain(body.siteId);

    const still = await ctx.app.request(`/s/${body.siteId}/`);
    expect(still.status).toBe(200);
    expect(await still.text()).toContain('Hello stage-drop');
  });

  it('unclaimed site becomes 410 after TTL and is swept', async () => {
    const ctx = await createTestApp({ ttlMs: 5_000 });
    cleanups.push(ctx.cleanup);

    const up = await ctx.app.request('/api/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/zip' },
      body: sampleSiteZip(),
    });
    const { siteId } = await up.json();

    expect((await ctx.app.request(`/s/${siteId}/`)).status).toBe(200);

    ctx.advance(5_001);
    expect((await ctx.app.request(`/s/${siteId}/`)).status).toBe(410);

    const removed = await sweepExpired(ctx.blob, ctx.meta, ctx.getNow());
    expect(removed).toContain(siteId);

    expect((await ctx.app.request(`/s/${siteId}/`)).status).toBe(404);
  });
});
