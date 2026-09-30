import { describe, it, expect, vi } from 'vitest';
import { KvMetaStore } from '../src/adapters/kv-meta-store.js';
import { R2BlobStore } from '../src/adapters/r2-blob-store.js';
import type { SiteMeta } from '../src/core/types.js';

function mockKv() {
  const store = new Map<string, string>();
  const kv = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async (opts: { prefix: string; cursor?: string }) => {
      const keys = [...store.keys()]
        .filter((k) => k.startsWith(opts.prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true, cursor: undefined };
    }),
  };
  return { kv: kv as unknown as KVNamespace, store };
}

function mockR2() {
  const objects = new Map<string, Uint8Array>();
  const bucket = {
    put: vi.fn(async (key: string, value: ArrayBuffer | Uint8Array | string) => {
      const data =
        typeof value === 'string'
          ? new TextEncoder().encode(value)
          : value instanceof Uint8Array
            ? value
            : new Uint8Array(value);
      objects.set(key, data);
    }),
    get: vi.fn(async (key: string) => {
      const data = objects.get(key);
      if (!data) return null;
      return {
        arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      };
    }),
    list: vi.fn(async (opts: { prefix: string; cursor?: string }) => {
      const matched = [...objects.keys()]
        .filter((k) => k.startsWith(opts.prefix))
        .map((key) => ({ key }));
      return { objects: matched, truncated: false, cursor: undefined };
    }),
    delete: vi.fn(async (keys: string | string[]) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) objects.delete(k);
    }),
  };
  return { bucket: bucket as unknown as R2Bucket, objects };
}

describe('KvMetaStore', () => {
  it('creates, looks up by claim hash, updates expiry index, lists expired', async () => {
    const { kv, store } = mockKv();
    const meta = new KvMetaStore(kv);
    const site: SiteMeta = {
      siteId: 'abc123',
      createdAt: 1000,
      expiresAt: 2000,
      claimTokenHash: 'hash1',
      claimed: false,
    };
    await meta.create(site);
    expect(store.has('meta:abc123')).toBe(true);
    expect(store.get('claim:hash1')).toBe('abc123');
    expect(store.has('exp:2000:abc123')).toBe(true);

    expect(await meta.getByClaimTokenHash('hash1')).toEqual(site);

    const claimed = { ...site, claimed: true, expiresAt: null, claimTokenHash: 'hash2' };
    await meta.update(claimed);
    expect(store.has('claim:hash1')).toBe(false);
    expect(store.get('claim:hash2')).toBe('abc123');
    expect(store.has('exp:2000:abc123')).toBe(false);

    // recreate unclaimed expired for sweep
    await meta.delete('abc123');
    await meta.create(site);
    const expired = await meta.listExpired(2000);
    expect(expired.map((s) => s.siteId)).toContain('abc123');
    const notYet = await meta.listExpired(1999);
    expect(notYet).toHaveLength(0);
  });
});

describe('R2BlobStore', () => {
  it('puts, gets, lists, and deletes a site prefix', async () => {
    const { bucket, objects } = mockR2();
    const blobs = new R2BlobStore(bucket);
    await blobs.put('site1', 'index.html', new TextEncoder().encode('<h1>hi</h1>'));
    await blobs.put('site1', 'style.css', new TextEncoder().encode('h1{}'));
    expect(objects.has('sites/site1/index.html')).toBe(true);

    const got = await blobs.get('site1', 'index.html');
    expect(got).not.toBeNull();
    expect(new TextDecoder().decode(got!)).toContain('hi');

    const listed = await blobs.list('site1');
    expect(listed.sort()).toEqual(['index.html', 'style.css']);

    await blobs.deleteSite('site1');
    expect(objects.size).toBe(0);
    expect(await blobs.get('site1', 'index.html')).toBeNull();
  });
});
