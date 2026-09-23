import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { createApp, type AppDeps } from '../src/core/app.js';
import { FsBlobStore } from '../src/adapters/fs-blob-store.js';
import { MemoryMetaStore } from '../src/adapters/memory-meta-store.js';
import { buildZip } from '../src/core/zip.js';
import { InMemoryRateLimiter } from '../src/core/rate-limit.js';
import type { AppConfig } from '../src/core/types.js';

export async function makeTempBlobRoot(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'stage-drop-'));
  return {
    root,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
}

export async function createTestApp(overrides: Partial<AppConfig> = {}) {
  const tmp = await makeTempBlobRoot();
  let clock = Date.now();
  const blob = new FsBlobStore(tmp.root);
  const meta = new MemoryMetaStore();
  const config: AppConfig = {
    publicBaseUrl: 'http://localhost:8787',
    ttlMs: 60 * 60 * 1000,
    maxZipBytes: 10 * 1024 * 1024,
    maxFiles: 500,
    rateLimit: { windowMs: 60_000, maxUploads: 100 },
    now: () => clock,
    ...overrides,
  };
  // re-bind now after spread so clock advances work
  config.now = () => clock;
  const rateLimiter = new InMemoryRateLimiter(
    config.rateLimit.windowMs,
    config.rateLimit.maxUploads,
    () => clock,
  );
  const deps: AppDeps = { blob, meta, config, rateLimiter };
  const app = createApp(deps);
  return {
    app,
    blob,
    meta,
    config,
    advance(ms: number) {
      clock += ms;
    },
    setNow(t: number) {
      clock = t;
    },
    getNow: () => clock,
    cleanup: tmp.cleanup,
  };
}

export function sampleSiteZip(extra: { path: string; data: string }[] = []) {
  return buildZip([
    { path: 'index.html', data: '<!doctype html><h1>Hello stage-drop</h1>' },
    { path: 'style.css', data: 'h1{color:tomato}' },
    ...extra,
  ]);
}

export function claimTokenFromUrl(claimUrl: string): string {
  const parts = claimUrl.split('/');
  return parts[parts.length - 1];
}
