export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  defaultTtl?: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for cache invalidation
  namespace?: string; // Namespace prefix for key isolation
}

export interface CacheEntry<T = unknown> {
  value: T;
  createdAt: number;
  ttl?: number;
  tags?: string[];
}
