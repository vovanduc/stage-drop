import type { MetaStore, SiteMeta } from '../core/types.js';

export class MemoryMetaStore implements MetaStore {
  private byId = new Map<string, SiteMeta>();
  private byHash = new Map<string, string>();

  async create(meta: SiteMeta): Promise<void> {
    if (this.byId.has(meta.siteId)) {
      throw new Error(`Site already exists: ${meta.siteId}`);
    }
    this.byId.set(meta.siteId, { ...meta });
    this.byHash.set(meta.claimTokenHash, meta.siteId);
  }

  async get(siteId: string): Promise<SiteMeta | null> {
    const m = this.byId.get(siteId);
    return m ? { ...m } : null;
  }

  async getByClaimTokenHash(hash: string): Promise<SiteMeta | null> {
    const id = this.byHash.get(hash);
    if (!id) return null;
    return this.get(id);
  }

  async update(meta: SiteMeta): Promise<void> {
    const prev = this.byId.get(meta.siteId);
    if (!prev) throw new Error(`Site not found: ${meta.siteId}`);
    if (prev.claimTokenHash !== meta.claimTokenHash) {
      this.byHash.delete(prev.claimTokenHash);
      this.byHash.set(meta.claimTokenHash, meta.siteId);
    }
    this.byId.set(meta.siteId, { ...meta });
  }

  async delete(siteId: string): Promise<void> {
    const prev = this.byId.get(siteId);
    if (prev) {
      this.byHash.delete(prev.claimTokenHash);
      this.byId.delete(siteId);
    }
  }

  async listExpired(now: number): Promise<SiteMeta[]> {
    const out: SiteMeta[] = [];
    for (const m of this.byId.values()) {
      if (!m.claimed && m.expiresAt !== null && m.expiresAt <= now) {
        out.push({ ...m });
      }
    }
    return out;
  }
}
