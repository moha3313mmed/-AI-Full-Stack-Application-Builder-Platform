import Redis from 'ioredis';

import type { CacheConfig, CacheOptions, CacheEntry } from './types';

export class CacheService {
  private client: Redis;
  private defaultTtl: number;
  private globalPrefix: string;

  constructor(config: CacheConfig) {
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      keyPrefix: config.keyPrefix,
    });
    this.defaultTtl = config.defaultTtl ?? 3600;
    this.globalPrefix = config.keyPrefix ?? '';
  }

  /**
   * Creates a CacheService from an existing Redis client (useful for testing/DI)
   */
  static fromClient(client: Redis, options?: { defaultTtl?: number; keyPrefix?: string }): CacheService {
    const service = Object.create(CacheService.prototype) as CacheService;
    service.client = client;
    service.defaultTtl = options?.defaultTtl ?? 3600;
    service.globalPrefix = options?.keyPrefix ?? '';
    return service;
  }

  async get<T = unknown>(key: string, namespace?: string): Promise<T | null> {
    const fullKey = this.buildKey(key, namespace);
    const raw = await this.client.get(fullKey);
    if (raw === null) return null;

    try {
      const entry: CacheEntry<T> = JSON.parse(raw);
      return entry.value;
    } catch {
      return null;
    }
  }

  async set<T = unknown>(
    key: string,
    value: T,
    options?: CacheOptions,
  ): Promise<void> {
    const fullKey = this.buildKey(key, options?.namespace);
    const ttl = options?.ttl ?? this.defaultTtl;

    const entry: CacheEntry<T> = {
      value,
      createdAt: Date.now(),
      ttl,
      tags: options?.tags,
    };

    const serialized = JSON.stringify(entry);

    if (ttl > 0) {
      await this.client.setex(fullKey, ttl, serialized);
    } else {
      await this.client.set(fullKey, serialized);
    }

    // Register tags if provided
    if (options?.tags && options.tags.length > 0) {
      await this.registerTags(fullKey, options.tags);
    }
  }

  async del(key: string, namespace?: string): Promise<void> {
    const fullKey = this.buildKey(key, namespace);
    await this.client.del(fullKey);
  }

  async exists(key: string, namespace?: string): Promise<boolean> {
    const fullKey = this.buildKey(key, namespace);
    const result = await this.client.exists(fullKey);
    return result === 1;
  }

  async getOrSet<T = unknown>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const existing = await this.get<T>(key, options?.namespace);
    if (existing !== null) {
      return existing;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  async flush(): Promise<void> {
    await this.client.flushdb();
  }

  async flushByPrefix(prefix: string, namespace?: string): Promise<void> {
    const fullPrefix = this.buildKey(prefix, namespace);
    const pattern = `${this.globalPrefix}${fullPrefix}*`;
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        // Remove the keyPrefix that ioredis adds automatically
        const keysWithoutPrefix = keys.map((k) =>
          this.globalPrefix ? k.slice(this.globalPrefix.length) : k,
        );
        await this.client.del(...keysWithoutPrefix);
      }
    } while (cursor !== '0');
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  private buildKey(key: string, namespace?: string): string {
    if (namespace) {
      return `${namespace}:${key}`;
    }
    return key;
  }

  private async registerTags(key: string, tags: string[]): Promise<void> {
    const pipeline = this.client.pipeline();
    for (const tag of tags) {
      pipeline.sadd(`__tag:${tag}`, key);
    }
    await pipeline.exec();
  }
}
