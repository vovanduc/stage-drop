export interface SiteMeta {
  siteId: string;
  createdAt: number;
  expiresAt: number | null;
  claimTokenHash: string;
  claimed: boolean;
}

export interface BlobStore {
  put(siteId: string, path: string, data: Uint8Array): Promise<void>;
  get(siteId: string, path: string): Promise<Uint8Array | null>;
  list(siteId: string): Promise<string[]>;
  deleteSite(siteId: string): Promise<void>;
}

export interface MetaStore {
  create(meta: SiteMeta): Promise<void>;
  get(siteId: string): Promise<SiteMeta | null>;
  getByClaimTokenHash(hash: string): Promise<SiteMeta | null>;
  update(meta: SiteMeta): Promise<void>;
  delete(siteId: string): Promise<void>;
  listExpired(now: number): Promise<SiteMeta[]>;
}

export interface ExtractedFile {
  path: string;
  data: Uint8Array;
}

export interface AppConfig {
  publicBaseUrl: string;
  ttlMs: number;
  maxZipBytes: number;
  maxFiles: number;
  rateLimit: {
    windowMs: number;
    maxUploads: number;
  };
  now?: () => number;
}
