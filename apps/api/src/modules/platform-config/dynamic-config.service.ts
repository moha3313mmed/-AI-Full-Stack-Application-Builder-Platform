import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigCategory } from '@prisma/client';

import { AppCacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

import { EncryptionService } from './encryption.service';

const CACHE_NAMESPACE = 'platform-config';
const CACHE_TTL = 300; // 5 minutes

@Injectable()
export class DynamicConfigService {
  private readonly logger = new Logger(DynamicConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: AppCacheService,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get a config value by category and key.
   * Priority: Redis cache -> Database (decrypted) -> Environment variable fallback
   */
  async getConfigValue(category: ConfigCategory, key: string): Promise<string | null> {
    const cacheKey = `dynamic:${category}:${key}`;

    // Check Redis cache first
    const cached = await this.cacheService.get<string>(cacheKey, CACHE_NAMESPACE);
    if (cached !== null) {
      return cached;
    }

    // Query database
    try {
      const config = await this.prisma.platformConfig.findUnique({
        where: { category_key: { category, key } },
      });

      if (config && config.isActive) {
        const value = config.isSecret
          ? this.encryptionService.decrypt(config.value)
          : config.value;

        // Cache the decrypted value
        // Security note: Decrypted secrets are stored in Redis with a short TTL.
        // In production, Redis should be configured with TLS (encryption in transit)
        // and access controls to maintain the security boundary.
        await this.cacheService.set(cacheKey, value, {
          ttl: CACHE_TTL,
          namespace: CACHE_NAMESPACE,
        });

        return value;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to read platform config ${category}/${key} from database, falling back to env`,
        error instanceof Error ? error.message : error,
      );
    }

    // Fall back to environment variable
    const envKey = this.toEnvKey(category, key);
    return this.configService.get<string>(envKey) || null;
  }

  /**
   * Convert category/key to a likely environment variable name.
   * e.g., AI_PROVIDERS/openai_api_key -> OPENAI_API_KEY
   */
  private toEnvKey(_category: ConfigCategory, key: string): string {
    return key.toUpperCase();
  }
}
