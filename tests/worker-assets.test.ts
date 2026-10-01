import { describe, expect, it } from 'vitest';
import {
  fetchAssetFollowingRedirects,
  prefixAssetLocation,
} from '../src/worker.js';

describe('prefixAssetLocation', () => {
  it('prefixes a root Location so the browser stays under /stage-drop', () => {
    expect(prefixAssetLocation('/')).toBe('/stage-drop/');
  });

  it('prefixes a non-root path', () => {
    expect(prefixAssetLocation('/app')).toBe('/stage-drop/app');
  });

  it('leaves an already-prefixed path alone', () => {
    expect(prefixAssetLocation('/stage-drop/')).toBe('/stage-drop/');
  });
});

describe('fetchAssetFollowingRedirects', () => {
  it('follows ASSETS 308 /index.html → / and returns the final 200 body', async () => {
    const calls: string[] = [];
    const assets = {
      async fetch(input: RequestInfo | URL) {
        const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
        calls.push(url);
        if (url.endsWith('/index.html')) {
          return new Response(null, {
            status: 308,
            headers: { Location: '/' },
          });
        }
        if (url.endsWith('/') || new URL(url).pathname === '/') {
          return new Response('<!doctype html><h1>UI</h1>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          });
        }
        return new Response('missing', { status: 404 });
      },
    };

    const res = await fetchAssetFollowingRedirects(
      assets,
      '/index.html',
      new Request('https://lab.vovanduc.tech/stage-drop/'),
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('UI');
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('/index.html');
    expect(calls[1]).toMatch(/assets\.local\/?$/);
    // Browser must never see Location: /
    expect(res.headers.get('Location')).toBeNull();
  });

  it('rewrites Location under /stage-drop when hops are exhausted', async () => {
    const assets = {
      async fetch() {
        return new Response(null, {
          status: 308,
          headers: { Location: '/' },
        });
      },
    };

    const res = await fetchAssetFollowingRedirects(
      assets,
      '/index.html',
      new Request('https://lab.vovanduc.tech/stage-drop/'),
      { maxHops: 0 },
    );

    expect(res.status).toBe(308);
    expect(res.headers.get('Location')).toBe('/stage-drop/');
  });
});
