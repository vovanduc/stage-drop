import type { MetaStore, SiteMeta } from '../core/types.js';

/**
 * MetaStore on Cloudflare KV.
 * - meta:{siteId} → SiteMeta JSON
 * - claim:{hash} → siteId
 * - exp:{expiresAt}:{siteId} → siteId (secondary index for sweep)
 */
export class KvMetaStore implements MetaStore {
  constructor(private readonly kv: KVNamespace) {}

  private metaKey(siteId: string): string {
    return `meta:${siteId}`;
  }

  private claimKey(hash: string): string {
    return `claim:${hash}`;
  }

  private expKey(expiresAt: number, siteId: string): string {
    return `exp:${expiresAt}:${siteId}`;
  }

  async create(meta: SiteMeta): Promise<void> {
    const existing = await this.kv.get(this.metaKey(meta.siteId));
    if (existing) {
      throw new Error(`Site already exists: ${meta.siteId}`);
    }
    await this.kv.put(this.metaKey(meta.siteId), JSON.stringify(meta));
    await this.kv.put(this.claimKey(meta.claimTokenHash), meta.siteId);
    if (meta.expiresAt !== null) {
      await this.kv.put(this.expKey(meta.expiresAt, meta.siteId), meta.siteId);
    }
  }

  async get(siteId: string): Promise<SiteMeta | null> {
    const raw = await this.kv.get(this.metaKey(siteId));
    if (!raw) return null;
    return JSON.parse(raw) as SiteMeta;
  }

  async getByClaimTokenHash(hash: string): Promise<SiteMeta | null> {
    const siteId = await this.kv.get(this.claimKey(hash));
    if (!siteId) return null;
    return this.get(siteId);
  }

  async update(meta: SiteMeta): Promise<void> {
    const prev = await this.get(meta.siteId);
    if (!prev) throw new Error(`Site not found: ${meta.siteId}`);

    if (prev.claimTokenHash !== meta.claimTokenHash) {
      await this.kv.delete(this.claimKey(prev.claimTokenHash));
      await this.kv.put(this.claimKey(meta.claimTokenHash), meta.siteId);
    }

    if (prev.expiresAt !== meta.expiresAt) {
      if (prev.expiresAt !== null) {
        await this.kv.delete(this.expKey(prev.expiresAt, meta.siteId));
      }
      if (meta.expiresAt !== null) {
        await this.kv.put(this.expKey(meta.expiresAt, meta.siteId), meta.siteId);
      }
    }

    await this.kv.put(this.metaKey(meta.siteId), JSON.stringify(meta));
  }

  async delete(siteId: string): Promise<void> {
    const prev = await this.get(siteId);
    if (!prev) return;
    await this.kv.delete(this.metaKey(siteId));
    await this.kv.delete(this.claimKey(prev.claimTokenHash));
    if (prev.expiresAt !== null) {
      await this.kv.delete(this.expKey(prev.expiresAt, siteId));
    }
  }

  async listExpired(now: number): Promise<SiteMeta[]> {
    const out: SiteMeta[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await this.kv.list({ prefix: 'exp:', cursor, limit: 1000 });
      for (const key of page.keys) {
        // exp:{expiresAt}:{siteId}
        const rest = key.name.slice('exp:'.length);
        const colon = rest.indexOf(':');
        if (colon < 0) continue;
        const expiresAt = Number(rest.slice(0, colon));
        const siteId = rest.slice(colon + 1);
        if (!Number.isFinite(expiresAt) || expiresAt > now) continue;
        if (seen.has(siteId)) continue;
        seen.add(siteId);
        const meta = await this.get(siteId);
        if (meta && !meta.claimed && meta.expiresAt !== null && meta.expiresAt <= now) {
          out.push(meta);
        }
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return out;
  }
}
