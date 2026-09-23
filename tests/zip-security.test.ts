import { describe, it, expect, afterEach } from 'vitest';
import { createTestApp, sampleSiteZip } from './helpers.js';
import { buildZip } from '../src/core/zip.js';
import { rawZip } from './raw-zip.js';

describe('zip security', () => {
  const cleanups: Array<() => Promise<void>> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  it('blocks zip-slip path traversal', async () => {
    const ctx = await createTestApp();
    cleanups.push(ctx.cleanup);

    // Craft zip with literal "../" entry names (adm-zip.addFile sanitizes them away)
    const zipBuf = rawZip([
      { name: '../evil.html', data: '<h1>evil</h1>' },
      { name: 'index.html', data: '<h1>ok</h1>' },
    ]);

    const res = await ctx.app.request('/api/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/zip' },
      body: zipBuf,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('ZIP_SLIP');
  });

  it('rejects oversized zip body', async () => {
    const ctx = await createTestApp({ maxZipBytes: 200 });
    cleanups.push(ctx.cleanup);

    const res = await ctx.app.request('/api/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/zip' },
      body: Buffer.alloc(250, 65),
    });
    expect(res.status).toBe(413);
  });

  it('rejects disallowed content types in zip', async () => {
    const ctx = await createTestApp();
    cleanups.push(ctx.cleanup);

    const zipBuf = buildZip([
      { path: 'index.html', data: '<h1>ok</h1>' },
      { path: 'malware.exe', data: 'MZ' },
    ]);
    const res = await ctx.app.request('/api/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/zip' },
      body: zipBuf,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('DISALLOWED_TYPE');
  });

  it('serves correct content-type for allowed files', async () => {
    const ctx = await createTestApp();
    cleanups.push(ctx.cleanup);

    const up = await ctx.app.request('/api/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/zip' },
      body: sampleSiteZip(),
    });
    const { siteId } = await up.json();

    const html = await ctx.app.request(`/s/${siteId}/`);
    expect(html.status).toBe(200);
    expect(html.headers.get('content-type')).toMatch(/text\/html/);

    const css = await ctx.app.request(`/s/${siteId}/style.css`);
    expect(css.status).toBe(200);
    expect(css.headers.get('content-type')).toMatch(/text\/css/);
  });
});
