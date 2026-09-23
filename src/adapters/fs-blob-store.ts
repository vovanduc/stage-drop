import { mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { BlobStore } from '../core/types.js';

export class FsBlobStore implements BlobStore {
  constructor(private readonly rootDir: string) {}

  private siteDir(siteId: string): string {
    return path.join(this.rootDir, siteId);
  }

  private resolveSafe(siteId: string, filePath: string): string {
    const base = this.siteDir(siteId);
    const resolved = path.resolve(base, filePath);
    if (!resolved.startsWith(path.resolve(base) + path.sep) && resolved !== path.resolve(base)) {
      throw new Error(`Unsafe blob path: ${filePath}`);
    }
    return resolved;
  }

  async put(siteId: string, filePath: string, data: Uint8Array): Promise<void> {
    const dest = this.resolveSafe(siteId, filePath);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, data);
  }

  async get(siteId: string, filePath: string): Promise<Uint8Array | null> {
    try {
      const dest = this.resolveSafe(siteId, filePath);
      const buf = await readFile(dest);
      return new Uint8Array(buf);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async list(siteId: string): Promise<string[]> {
    const base = this.siteDir(siteId);
    const results: string[] = [];
    async function walk(dir: string, prefix: string): Promise<void> {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw err;
      }
      for (const e of entries) {
        const rel = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.isDirectory()) await walk(path.join(dir, e.name), rel);
        else results.push(rel);
      }
    }
    await walk(base, '');
    return results;
  }

  async deleteSite(siteId: string): Promise<void> {
    await rm(this.siteDir(siteId), { recursive: true, force: true });
  }
}
