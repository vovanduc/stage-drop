import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { createApp, sweepExpired } from './core/app.js';
import { FsBlobStore } from './adapters/fs-blob-store.js';
import { MemoryMetaStore } from './adapters/memory-meta-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(root, 'data', 'blobs');
const port = Number(process.env.PORT || 8787);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const ttlMs = Number(process.env.TTL_MS || 60 * 60 * 1000);

await mkdir(dataDir, { recursive: true });

const blob = new FsBlobStore(dataDir);
const meta = new MemoryMetaStore();

const app = createApp({
  blob,
  meta,
  config: {
    publicBaseUrl,
    ttlMs,
    maxZipBytes: 10 * 1024 * 1024,
    maxFiles: 500,
    rateLimit: { windowMs: 60_000, maxUploads: 30 },
  },
});

// Static UI (drag-drop page)
app.use('/*', serveStatic({ root: path.join(root, 'public') }));

const sweepEveryMs = Number(process.env.SWEEP_MS || 60_000);
setInterval(() => {
  void sweepExpired(blob, meta).then((ids) => {
    if (ids.length) console.log(`[sweep] removed ${ids.length} expired site(s):`, ids.join(', '));
  });
}, sweepEveryMs).unref();

console.log(`stage-drop listening on ${publicBaseUrl}`);
serve({ fetch: app.fetch, port });
