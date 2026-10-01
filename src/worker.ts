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
const ASSETS_ORIGIN = 'https://assets.local';
/** Cap internal ASSETS redirect hops (html_handling can 3xx a few times). */
const MAX_ASSET_REDIRECTS = 3;

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

/**
 * Rewrite an ASSETS Location so the browser stays under /stage-drop/.
 * ASSETS returns paths relative to the asset root (e.g. `/`), which the
 * browser would otherwise resolve against the origin root and leave the mount.
 */
export function prefixAssetLocation(location: string, mountPrefix = STAGE_PREFIX): string {
  // Absolute URL → keep origin, rewrite path under mount if needed.
  try {
    if (/^https?:\/\//i.test(location)) {
      const u = new URL(location);
      if (!u.pathname.startsWith(mountPrefix)) {
        u.pathname = `${mountPrefix}${u.pathname === '/' ? '/' : u.pathname}`;
      }
      return u.toString();
    }
  } catch {
    /* fall through to path handling */
  }
  const path = location.startsWith('/') ? location : `/${location}`;
  if (path.startsWith(mountPrefix)) return path;
  return `${mountPrefix}${path === '/' ? '/' : path}`;
}

type AssetFetcher = { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> };

/**
 * Fetch from ASSETS and follow redirects on the binding (not in the browser).
 *
 * Why: with html_handling auto-trailing-slash, ASSETS often responds to
 * `/index.html` with 308 Location: `/`. Returning that to the client makes
 * the browser leave `/stage-drop/` and hit the lab hub at `/`.
 *
 * We follow up to maxHops on the ASSETS fetcher and return the final 200 body.
 * If a redirect remains (exhausted hops / unfollowable), Location is rewritten
 * under mountPrefix as a safety net.
 */
export async function fetchAssetFollowingRedirects(
  assets: AssetFetcher,
  assetPath: string,
  raw: Request,
  opts: { maxHops?: number; mountPrefix?: string; assetsOrigin?: string } = {},
): Promise<Response> {
  const maxHops = opts.maxHops ?? MAX_ASSET_REDIRECTS;
  const mountPrefix = opts.mountPrefix ?? STAGE_PREFIX;
  const assetsOrigin = opts.assetsOrigin ?? ASSETS_ORIGIN;

  let current = new URL(assetPath, assetsOrigin);

  for (let hop = 0; hop <= maxHops; hop++) {
    const res = await assets.fetch(new Request(current.toString(), raw));

    // Success / error — hand through (including 404 so caller can fall back).
    if (res.status < 300 || res.status >= 400) {
      return res;
    }

    const location = res.headers.get('Location');
    if (!location) return res;

    const next = new URL(location, current);

    // Same-host ASSETS redirect: follow internally while hops remain.
    if (next.origin === current.origin && hop < maxHops) {
      current = next;
      // 301/302/303 → subsequent fetch as GET; 307/308 keep method (Request copy).
      if (res.status === 301 || res.status === 302 || res.status === 303) {
        raw = new Request(current.toString(), { method: 'GET', headers: raw.headers });
      }
      continue;
    }

    // Exhausted hops or cross-origin: never leak a bare `/` Location to the browser.
    const headers = new Headers(res.headers);
    headers.set('Location', prefixAssetLocation(location, mountPrefix));
    return new Response(null, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  }

  // Unreachable, but satisfy the type checker.
  return assets.fetch(new Request(current.toString(), raw));
}

async function serveAsset(env: Env, assetPath: string, raw: Request): Promise<Response> {
  return fetchAssetFollowingRedirects(env.ASSETS, assetPath, raw);
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
