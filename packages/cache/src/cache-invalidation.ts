import Redis from 'ioredis';

export class CacheInvalidation {
  private client: Redis;

  constructor(client: Redis) {
    this.client = client;
  }

  /**
   * Register a key with one or more tags for later invalidation
   */
  async registerTaggedKey(key: string, tags: string[]): Promise<void> {
    const pipeline = this.client.pipeline();
    for (const tag of tags) {
      pipeline.sadd(`__tag:${tag}`, key);
    }
    await pipeline.exec();
  }

  /**
   * Invalidate all keys associated with the given tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let totalDeleted = 0;

    for (const tag of tags) {
      const tagKey = `__tag:${tag}`;
      const keys = await this.client.smembers(tagKey);

      if (keys.length > 0) {
        const deleted = await this.client.del(...keys);
        totalDeleted += deleted;
        // Clean up the tag set itself
        await this.client.del(tagKey);
      }
    }

    return totalDeleted;
  }

  /**
   * Invalidate all keys matching the given pattern using SCAN
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    let totalDeleted = 0;
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
        const deleted = await this.client.del(...keys);
        totalDeleted += deleted;
      }
    } while (cursor !== '0');

    return totalDeleted;
  }

  /**
   * Get all keys associated with a specific tag
   */
  async getKeysByTag(tag: string): Promise<string[]> {
    return this.client.smembers(`__tag:${tag}`);
  }

  /**
   * Remove a key from all its associated tags
   */
  async unregisterKey(key: string, tags: string[]): Promise<void> {
    const pipeline = this.client.pipeline();
    for (const tag of tags) {
      pipeline.srem(`__tag:${tag}`, key);
    }
    await pipeline.exec();
  }
}
