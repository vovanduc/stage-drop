import { createApp, sweepExpired } from './core/app.js';
import { R2BlobStore } from './adapters/r2-blob-store.js';
import { KvMetaStore } from './adapters/kv-meta-store.js';

/**
 * Cloudflare Worker env for stage-drop lab deploy.
 * Custom Domain: lab.vovanduc.tech → Worker name "lab"
 * App lives under /stage-drop/
 */
export interface Env {
  BLOBS: R2Bucket;
  META: KVNamespace;
  ASSETS: Fetcher;
}

const PUBLIC_BASE_URL = 'https://lab.vovanduc.tech/stage-drop';
const STAGE_PREFIX = '/stage-drop';

function createStageApp(env: Env) {
  return createApp({
    blob: new R2BlobStore(env.BLOBS),
    meta: new KvMetaStore(env.META),
    config: {
      publicBaseUrl: PUBLIC_BASE_URL,
      ttlMs: 60 * 60 * 1000,
      maxZipBytes: 10 * 1024 * 1024,
      maxFiles: 500,
      rateLimit: { windowMs: 60_000, maxUploads: 30 },
    },
  });
}

async function serveAsset(env: Env, assetPath: string, raw: Request): Promise<Response> {
  const url = new URL(assetPath, 'https://assets.local');
  return env.ASSETS.fetch(new Request(url.toString(), raw));
}

function isStaticAssetPath(pathname: string): boolean {
  if (pathname === '/' || pathname === '/index.html') return true;
  // Anything that is not the API surface
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/claim') ||
    pathname.startsWith('/s/') ||
    pathname === '/health'
  ) {
    return false;
  }
  return true;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Lab hub at Worker root
    if (url.pathname === '/') {
      return Response.json({
        service: 'lab',
        message: 'lab hub — stage-drop lives under /stage-drop/',
        stageDrop: `${PUBLIC_BASE_URL}/`,
        health: `${PUBLIC_BASE_URL}/health`,
      });
    }

    if (url.pathname === STAGE_PREFIX) {
      return Response.redirect(`${url.origin}${STAGE_PREFIX}/`, 302);
    }

    if (!url.pathname.startsWith(`${STAGE_PREFIX}/`) && url.pathname !== STAGE_PREFIX) {
      return Response.json({ error: 'Not Found' }, { status: 404 });
    }

    // Strip /stage-drop so createApp sees /health, /api/upload, /s/:id, …
    const stripped = new URL(request.url);
    stripped.pathname = url.pathname.slice(STAGE_PREFIX.length) || '/';

    if (isStaticAssetPath(stripped.pathname) && request.method === 'GET') {
      const assetPath =
        stripped.pathname === '/' ? '/index.html' : stripped.pathname;
      const assetRes = await serveAsset(env, assetPath, request);
      if (assetRes.status !== 404) return assetRes;
      // fall through to stage (e.g. unknown path → 404 JSON)
    }

    const stage = createStageApp(env);
    return stage.fetch(new Request(stripped.toString(), request), env, ctx);
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const blob = new R2BlobStore(env.BLOBS);
    const meta = new KvMetaStore(env.META);
    ctx.waitUntil(
      sweepExpired(blob, meta).then((ids) => {
        if (ids.length) {
          console.log(`[sweep] removed ${ids.length} expired site(s):`, ids.join(', '));
        }
      }),
    );
  },
};
