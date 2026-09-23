import AdmZip from 'adm-zip';
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

export function extractZip(
  buffer: Buffer,
  opts: { maxZipBytes: number; maxFiles: number },
): ExtractedFile[] {
  if (buffer.byteLength > opts.maxZipBytes) {
    throw new ZipValidationError(
      `Zip exceeds max size of ${opts.maxZipBytes} bytes`,
      'TOO_LARGE',
    );
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new ZipValidationError('Invalid zip archive', 'INVALID_ZIP');
  }

  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  if (entries.length === 0) {
    throw new ZipValidationError('Zip contains no files', 'EMPTY');
  }
  if (entries.length > opts.maxFiles) {
    throw new ZipValidationError(
      `Zip exceeds max file count of ${opts.maxFiles}`,
      'TOO_MANY_FILES',
    );
  }

  const files: ExtractedFile[] = [];
  for (const entry of entries) {
    const safePath = normalizeEntryPath(entry.entryName);
    if (!safePath) {
      throw new ZipValidationError(
        `Blocked unsafe path: ${entry.entryName}`,
        'ZIP_SLIP',
      );
    }
    if (!isAllowedExtension(safePath)) {
      throw new ZipValidationError(
        `Disallowed file type: ${safePath}`,
        'DISALLOWED_TYPE',
      );
    }
    files.push({ path: safePath, data: new Uint8Array(entry.getData()) });
  }
  return files;
}

/** Build a zip in-memory for tests / folder uploads converted to zip. */
export function buildZip(files: { path: string; data: Buffer | string }[]): Buffer {
  const zip = new AdmZip();
  for (const f of files) {
    const data = typeof f.data === 'string' ? Buffer.from(f.data, 'utf8') : f.data;
    zip.addFile(f.path, data);
  }
  return zip.toBuffer();
}
