import { unzipSync, zipSync, strToU8 } from 'fflate';
import { isAllowedExtension } from './content-types.js';
import type { ExtractedFile } from './types.js';

export class ZipValidationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'TOO_LARGE'
      | 'TOO_MANY_FILES'
      | 'ZIP_SLIP'
      | 'EMPTY'
      | 'DISALLOWED_TYPE'
      | 'INVALID_ZIP',
  ) {
    super(message);
    this.name = 'ZipValidationError';
  }
}

function normalizeEntryPath(entryName: string): string | null {
  // Reject absolute / Windows drive / backslash-heavy escapes early
  if (entryName.startsWith('/') || /^[a-zA-Z]:/.test(entryName)) {
    return null;
  }
  const normalized = entryName.replace(/\\/g, '/').replace(/^\.\//, '');
  const parts = normalized.split('/').filter((p) => p.length > 0);
  if (parts.some((p) => p === '..')) {
    return null;
  }
  if (parts.length === 0) return null;
  return parts.join('/');
}

/**
 * Extract + validate a zip. Accepts Uint8Array (Workers) or Buffer (Node).
 * Uses fflate so the same path works on Cloudflare Workers and Node.
 */
export function extractZip(
  buffer: Uint8Array,
  opts: { maxZipBytes: number; maxFiles: number },
): ExtractedFile[] {
  if (buffer.byteLength > opts.maxZipBytes) {
    throw new ZipValidationError(
      `Zip exceeds max size of ${opts.maxZipBytes} bytes`,
      'TOO_LARGE',
    );
  }

  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(buffer);
  } catch {
    throw new ZipValidationError('Invalid zip archive', 'INVALID_ZIP');
  }

  const entryNames = Object.keys(unzipped).filter((name) => !name.endsWith('/'));
  if (entryNames.length === 0) {
    throw new ZipValidationError('Zip contains no files', 'EMPTY');
  }
  if (entryNames.length > opts.maxFiles) {
    throw new ZipValidationError(
      `Zip exceeds max file count of ${opts.maxFiles}`,
      'TOO_MANY_FILES',
    );
  }

  const files: ExtractedFile[] = [];
  for (const entryName of entryNames) {
    const safePath = normalizeEntryPath(entryName);
    if (!safePath) {
      throw new ZipValidationError(`Blocked unsafe path: ${entryName}`, 'ZIP_SLIP');
    }
    if (!isAllowedExtension(safePath)) {
      throw new ZipValidationError(
        `Disallowed file type: ${safePath}`,
        'DISALLOWED_TYPE',
      );
    }
    files.push({ path: safePath, data: unzipped[entryName]! });
  }
  return files;
}

/** Build a zip in-memory for tests / folder uploads converted to zip. */
export function buildZip(
  files: { path: string; data: Uint8Array | string }[],
): Uint8Array {
  const obj: Record<string, Uint8Array> = {};
  for (const f of files) {
    obj[f.path] = typeof f.data === 'string' ? strToU8(f.data) : f.data;
  }
  return zipSync(obj);
}
