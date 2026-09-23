import { Hono } from 'hono';
import type { Context } from 'hono';
import type { BlobStore, MetaStore, AppConfig } from './types.js';
import { extractZip, ZipValidationError } from './zip.js';
import { generateClaimToken, generateSiteId, hashClaimToken } from './tokens.js';
import { contentTypeForPath } from './content-types.js';
import { InMemoryRateLimiter } from './rate-limit.js';

export interface AppDeps {
  blob: BlobStore;
  meta: MetaStore;
  config: AppConfig;
  rateLimiter?: InMemoryRateLimiter;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000;
const DEFAULT_MAX_ZIP = 10 * 1024 * 1024;
const DEFAULT_MAX_FILES = 500;

export function createApp(deps: AppDeps): Hono {
  const { blob, meta } = deps;
  const config: Required<AppConfig> = {
    publicBaseUrl: deps.config.publicBaseUrl.replace(/\/$/, ''),
    ttlMs: deps.config.ttlMs ?? DEFAULT_TTL_MS,
    maxZipBytes: deps.config.maxZipBytes ?? DEFAULT_MAX_ZIP,
    maxFiles: deps.config.maxFiles ?? DEFAULT_MAX_FILES,
    rateLimit: deps.config.rateLimit ?? { windowMs: 60_000, maxUploads: 20 },
    now: deps.config.now ?? (() => Date.now()),
  };
  const limiter =
    deps.rateLimiter ??
    new InMemoryRateLimiter(config.rateLimit.windowMs, config.rateLimit.maxUploads, config.now);

  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true }));

  app.post('/api/upload', async (c) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'unknown';
    const rl = limiter.check(ip);
    if (!rl.allowed) {
      return c.json(
        { error: 'Rate limit exceeded', retryAfterMs: rl.retryAfterMs },
        429,
      );
    }

    let buffer: Buffer;
    const contentType = c.req.header('content-type') || '';
    try {
      if (contentType.includes('multipart/form-data')) {
        const body = await c.req.parseBody({ all: true });
        const raw = body['file'] ?? body['zip'];
        const file = Array.isArray(raw) ? raw[0] : raw;
        if (!file || typeof file === 'string') {
          return c.json({ error: 'Expected multipart field "file" with a zip' }, 400);
        }
        buffer = Buffer.from(await file.arrayBuffer());
      } else if (
        contentType.includes('application/zip') ||
        contentType.includes('application/octet-stream') ||
        contentType === ''
      ) {
        buffer = Buffer.from(await c.req.arrayBuffer());
      } else {
        return c.json({ error: 'Unsupported content type; send a zip' }, 415);
      }
    } catch {
      return c.json({ error: 'Failed to read upload body' }, 400);
    }

    if (buffer.byteLength === 0) {
      return c.json({ error: 'Empty body' }, 400);
    }
    if (buffer.byteLength > config.maxZipBytes) {
      return c.json(
        { error: `Zip exceeds max size of ${config.maxZipBytes} bytes`, code: 'TOO_LARGE' },
        413,
      );
    }

    let files;
    try {
      files = extractZip(buffer, {
        maxZipBytes: config.maxZipBytes,
        maxFiles: config.maxFiles,
      });
    } catch (err) {
      if (err instanceof ZipValidationError) {
        const status = err.code === 'TOO_LARGE' ? 413 : 400;
        return c.json({ error: err.message, code: err.code }, status);
      }
      throw err;
    }

    const siteId = generateSiteId();
    const claimToken = generateClaimToken();
    const claimTokenHash = hashClaimToken(claimToken);
    const now = config.now();
    const expiresAt = now + config.ttlMs;

    for (const f of files) {
      await blob.put(siteId, f.path, f.data);
    }
    await meta.create({
      siteId,
      createdAt: now,
      expiresAt,
      claimTokenHash,
      claimed: false,
    });

    return c.json({
      siteId,
      liveUrl: `${config.publicBaseUrl}/s/${siteId}/`,
      claimUrl: `${config.publicBaseUrl}/claim/${claimToken}`,
      expiresAt,
      expiresInMs: config.ttlMs,
    });
  });

  app.get('/claim/:token', async (c) => {
    const token = c.req.param('token');
    const result = await claimSite(meta, token);
    if (!result.ok) {
      return c.html(
        `<!doctype html><html><body><h1>Claim failed</h1><p>${escapeHtml(result.error)}</p></body></html>`,
        result.status,
      );
    }
    return c.redirect(`/s/${result.siteId}/`, 302);
  });

  app.post('/api/claim/:token', async (c) => {
    const token = c.req.param('token');
    const result = await claimSite(meta, token);
    if (!result.ok) {
      return c.json({ error: result.error }, result.status);
    }
    return c.json({
      siteId: result.siteId,
      liveUrl: `${config.publicBaseUrl}/s/${result.siteId}/`,
      claimed: true,
    });
  });

  app.get('/s/:siteId', (c) => c.redirect(`/s/${c.req.param('siteId')}/`, 302));

  app.get('/s/:siteId/', (c) => serveFile(c, blob, meta, config, 'index.html'));

  app.get('/s/:siteId/*', async (c) => {
    const siteId = c.req.param('siteId');
    const prefix = `/s/${siteId}/`;
    const wildcard = c.req.path.startsWith(prefix)
      ? c.req.path.slice(prefix.length)
      : '';
    const filePath = wildcard === '' ? 'index.html' : decodeURIComponent(wildcard);
    return serveFile(c, blob, meta, config, filePath);
  });

  return app;
}

async function claimSite(
  meta: MetaStore,
  token: string,
): Promise<
  | { ok: true; siteId: string }
  | { ok: false; error: string; status: 400 | 404 | 410 }
> {
  if (!token || token.length < 32) {
    return { ok: false, error: 'Invalid claim token', status: 400 };
  }
  const hash = hashClaimToken(token);
  const site = await meta.getByClaimTokenHash(hash);
  if (!site) {
    return { ok: false, error: 'Claim token not found or already used', status: 404 };
  }
  if (site.claimed) {
    return { ok: false, error: 'Already claimed', status: 400 };
  }
  site.claimed = true;
  site.expiresAt = null;
  // One-shot: rotate hash so the original token can never match again
  site.claimTokenHash = hashClaimToken(generateClaimToken());
  await meta.update(site);
  return { ok: true, siteId: site.siteId };
}

async function serveFile(
  c: Context,
  blob: BlobStore,
  meta: MetaStore,
  config: Required<AppConfig>,
  filePath: string,
): Promise<Response> {
  const siteId = c.req.param('siteId');
  if (!siteId) {
    return c.json({ error: 'Site not found' }, 404);
  }
  const site = await meta.get(siteId);
  if (!site) {
    return c.json({ error: 'Site not found' }, 404);
  }
  const now = config.now();
  if (!site.claimed && site.expiresAt !== null && site.expiresAt <= now) {
    return c.json({ error: 'Gone — site expired and was not claimed' }, 410);
  }

  if (filePath.includes('..') || filePath.startsWith('/') || filePath.includes('\\')) {
    return c.json({ error: 'Invalid path' }, 400);
  }

  const ct = contentTypeForPath(filePath);
  if (!ct) {
    return c.json({ error: 'Disallowed content type' }, 404);
  }

  let data = await blob.get(siteId, filePath);
  if (!data && !filePath.includes('.')) {
    data = await blob.get(siteId, `${filePath.replace(/\/$/, '')}/index.html`);
  }
  if (!data) {
    return c.json({ error: 'File not found' }, 404);
  }

  return new Response(Buffer.from(data), {
    status: 200,
    headers: {
      'content-type': ct,
      'cache-control': site.claimed ? 'public, max-age=60' : 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

/** Delete expired unclaimed sites from blob + meta. */
export async function sweepExpired(
  blob: BlobStore,
  meta: MetaStore,
  now: number = Date.now(),
): Promise<string[]> {
  const expired = await meta.listExpired(now);
  const removed: string[] = [];
  for (const site of expired) {
    await blob.deleteSite(site.siteId);
    await meta.delete(site.siteId);
    removed.push(site.siteId);
  }
  return removed;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
