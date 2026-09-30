import type { BlobStore } from '../core/types.js';

/** BlobStore backed by Cloudflare R2. Keys: sites/{siteId}/{path} */
export class R2BlobStore implements BlobStore {
  constructor(
    private readonly bucket: R2Bucket,
    private readonly prefix = 'sites',
  ) {}

  private key(siteId: string, filePath: string): string {
    return `${this.prefix}/${siteId}/${filePath}`;
  }

  async put(siteId: string, filePath: string, data: Uint8Array): Promise<void> {
    await this.bucket.put(this.key(siteId, filePath), data);
  }

  async get(siteId: string, filePath: string): Promise<Uint8Array | null> {
    const obj = await this.bucket.get(this.key(siteId, filePath));
    if (!obj) return null;
    return new Uint8Array(await obj.arrayBuffer());
  }

  async list(siteId: string): Promise<string[]> {
    const prefix = `${this.prefix}/${siteId}/`;
    const results: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.bucket.list({ prefix, cursor, limit: 1000 });
      for (const obj of page.objects) {
        results.push(obj.key.slice(prefix.length));
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return results;
  }

  async deleteSite(siteId: string): Promise<void> {
    const paths = await this.list(siteId);
    const keys = paths.map((p) => this.key(siteId, p));
    for (let i = 0; i < keys.length; i += 1000) {
      await this.bucket.delete(keys.slice(i, i + 1000));
    }
  }
}
