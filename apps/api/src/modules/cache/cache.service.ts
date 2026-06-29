import { CacheService } from '@builder/cache';
import type { CacheOptions } from '@builder/cache';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfiguration } from '../../config/configuration';

@Injectable()
export class AppCacheService implements OnModuleDestroy {
  private cacheService: CacheService;

  constructor(private readonly configService: ConfigService<AppConfiguration>) {
    const redisUrl = this.configService.get('redis', { infer: true })?.url ?? 'redis://localhost:6379';
    const parsed = this.parseRedisUrl(redisUrl);

    this.cacheService = new CacheService({
      host: parsed.host,
      port: parsed.port,
      password: parsed.password,
      keyPrefix: 'api:',
    });
  }

  async get<T = unknown>(key: string, namespace?: string): Promise<T | null> {
    return this.cacheService.get<T>(key, namespace);
  }

  async set<T = unknown>(key: string, value: T, options?: CacheOptions): Promise<void> {
    return this.cacheService.set(key, value, options);
  }

  async del(key: string, namespace?: string): Promise<void> {
    return this.cacheService.del(key, namespace);
  }

  async invalidate(pattern: string, namespace?: string): Promise<void> {
    return this.cacheService.flushByPrefix(pattern, namespace);
  }

  async getOrSet<T = unknown>(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T> {
    return this.cacheService.getOrSet(key, factory, options);
  }

  async onModuleDestroy(): Promise<void> {
    await this.cacheService.disconnect();
  }

  private parseRedisUrl(url: string): { host: string; port: number; password?: string } {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname || 'localhost',
        port: parseInt(parsed.port || '6379', 10),
        password: parsed.password || undefined,
      };
    } catch {
      return { host: 'localhost', port: 6379 };
    }
  }
}
