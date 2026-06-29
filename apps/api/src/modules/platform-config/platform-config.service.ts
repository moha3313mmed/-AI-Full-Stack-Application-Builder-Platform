import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigCategory, Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AppCacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

import { CreateConfigDto } from './dto/create-config.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { EncryptionService } from './encryption.service';

const CACHE_NAMESPACE = 'platform-config';
const CACHE_TTL = 300; // 5 minutes

@Injectable()
export class PlatformConfigService {
  private readonly logger = new Logger(PlatformConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: AppCacheService,
    private readonly auditService: AuditService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async getAllByCategory(category: ConfigCategory) {
    const cacheKey = `category:${category}`;

    const cached = await this.cacheService.get<unknown[]>(cacheKey, CACHE_NAMESPACE);
    if (cached) {
      return cached;
    }

    const configs = await this.prisma.platformConfig.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });

    const masked = configs.map((config) => ({
      ...config,
      value: config.isSecret ? this.maskValue(config.value) : config.value,
    }));

    await this.cacheService.set(cacheKey, masked, {
      ttl: CACHE_TTL,
      namespace: CACHE_NAMESPACE,
    });

    return masked;
  }

  async getOne(category: ConfigCategory, key: string) {
    const cacheKey = `config:${category}:${key}`;

    const cached = await this.cacheService.get<unknown>(cacheKey, CACHE_NAMESPACE);
    if (cached) {
      return cached;
    }

    const config = await this.prisma.platformConfig.findUnique({
      where: { category_key: { category, key } },
    });

    if (!config) {
      throw new NotFoundException(`Config not found: ${category}/${key}`);
    }

    const result = {
      ...config,
      value: config.isSecret ? this.maskValue(config.value) : config.value,
    };

    await this.cacheService.set(cacheKey, result, {
      ttl: CACHE_TTL,
      namespace: CACHE_NAMESPACE,
    });

    return result;
  }

  async upsert(dto: CreateConfigDto, userId: string) {
    const encryptedValue = dto.isSecret !== false
      ? this.encryptionService.encrypt(dto.value)
      : dto.value;

    const config = await this.prisma.platformConfig.upsert({
      where: {
        category_key: {
          category: dto.category as unknown as ConfigCategory,
          key: dto.key,
        },
      },
      create: {
        category: dto.category as unknown as ConfigCategory,
        key: dto.key,
        value: encryptedValue,
        displayName: dto.displayName,
        description: dto.description,
        isSecret: dto.isSecret ?? true,
        metadata: (dto.metadata as Prisma.InputJsonValue) || Prisma.JsonNull,
      },
      update: {
        value: encryptedValue,
        displayName: dto.displayName,
        description: dto.description,
        isSecret: dto.isSecret ?? true,
        metadata: (dto.metadata as Prisma.InputJsonValue) || Prisma.JsonNull,
      },
    });

    await this.invalidateCache(dto.category as unknown as ConfigCategory, dto.key);

    await this.auditService.logAction({
      userId,
      action: 'platform_config.upsert',
      resource: 'platform_config',
      resourceId: config.id,
      metadata: { category: dto.category, key: dto.key },
    });

    return {
      ...config,
      value: config.isSecret ? this.maskValue(config.value) : config.value,
    };
  }

  async update(category: ConfigCategory, key: string, dto: UpdateConfigDto, userId: string) {
    const existing = await this.prisma.platformConfig.findUnique({
      where: { category_key: { category, key } },
    });

    if (!existing) {
      throw new NotFoundException(`Config not found: ${category}/${key}`);
    }

    const updateData: Record<string, unknown> = {};

    if (dto.value !== undefined) {
      updateData.value = existing.isSecret
        ? this.encryptionService.encrypt(dto.value)
        : dto.value;
    }
    if (dto.displayName !== undefined) updateData.displayName = dto.displayName;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata as Prisma.InputJsonValue;

    const config = await this.prisma.platformConfig.update({
      where: { category_key: { category, key } },
      data: updateData,
    });

    await this.invalidateCache(category, key);

    await this.auditService.logAction({
      userId,
      action: 'platform_config.update',
      resource: 'platform_config',
      resourceId: config.id,
      metadata: { category, key },
    });

    return {
      ...config,
      value: config.isSecret ? this.maskValue(config.value) : config.value,
    };
  }

  async delete(category: ConfigCategory, key: string, userId: string) {
    const config = await this.prisma.platformConfig.findUnique({
      where: { category_key: { category, key } },
    });

    if (!config) {
      throw new NotFoundException(`Config not found: ${category}/${key}`);
    }

    await this.prisma.platformConfig.delete({
      where: { category_key: { category, key } },
    });

    await this.invalidateCache(category, key);

    await this.auditService.logAction({
      userId,
      action: 'platform_config.delete',
      resource: 'platform_config',
      resourceId: config.id,
      metadata: { category, key },
    });

    return { success: true };
  }

  async testConnection(category: ConfigCategory, key: string, value?: string) {
    try {
      let testValue = value;

      // If no value provided, fetch and decrypt the stored value
      if (!testValue) {
        const config = await this.prisma.platformConfig.findUnique({
          where: { category_key: { category, key } },
        });

        if (!config) {
          return { success: false, message: 'No stored configuration found for this key' };
        }

        testValue = config.isSecret
          ? this.encryptionService.decrypt(config.value)
          : config.value;
      }

      // Provider-specific connection testing
      switch (category) {
        case ConfigCategory.AI_PROVIDERS:
          return await this.testAiProvider(key, testValue);
        case ConfigCategory.EMAIL_PROVIDERS:
          return await this.testEmailProvider(key, testValue);
        case ConfigCategory.DATABASES:
          return await this.testDatabaseConnection(key, testValue);
        default:
          return { success: true, message: 'Connection test not available for this provider' };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection test failed';
      return { success: false, message };
    }
  }

  async rotateKey(oldEncryptionKey: string, newEncryptionKey: string, userId: string) {
    const configs = await this.prisma.platformConfig.findMany({
      where: { isSecret: true },
    });

    // Re-encrypt all values and collect updates
    const updates = configs.map((config) => {
      const newEncryptedValue = this.encryptionService.rotateEncryption(
        oldEncryptionKey,
        newEncryptionKey,
        config.value,
      );

      return this.prisma.platformConfig.update({
        where: { id: config.id },
        data: {
          value: newEncryptedValue,
          lastRotatedAt: new Date(),
        },
      });
    });

    // Execute all updates atomically in a transaction
    await this.prisma.$transaction(updates);

    await this.auditService.logAction({
      userId,
      action: 'platform_config.rotate_key',
      resource: 'platform_config',
      metadata: { rotatedCount: configs.length, totalConfigs: configs.length },
    });

    await this.cacheService.invalidate(CACHE_NAMESPACE, CACHE_NAMESPACE);

    return { rotatedCount: configs.length, totalConfigs: configs.length };
  }

  async backup(userId: string) {
    const configs = await this.prisma.platformConfig.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    await this.auditService.logAction({
      userId,
      action: 'platform_config.backup',
      resource: 'platform_config',
      metadata: { configCount: configs.length },
    });

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      configs: configs.map((config) => ({
        category: config.category,
        key: config.key,
        value: config.value, // Already encrypted
        displayName: config.displayName,
        description: config.description,
        isSecret: config.isSecret,
        isActive: config.isActive,
        metadata: config.metadata,
      })),
    };
  }

  async restore(
    backup: {
      version: number;
      configs: Array<{
        category: ConfigCategory;
        key: string;
        value: string;
        displayName: string;
        description?: string | null;
        isSecret: boolean;
        isActive: boolean;
        metadata?: unknown;
      }>;
    },
    userId: string,
  ) {
    let restoredCount = 0;

    for (const config of backup.configs) {
      await this.prisma.platformConfig.upsert({
        where: {
          category_key: { category: config.category, key: config.key },
        },
        create: {
          category: config.category,
          key: config.key,
          value: config.value,
          displayName: config.displayName,
          description: config.description,
          isSecret: config.isSecret,
          isActive: config.isActive,
          metadata: (config.metadata as Prisma.InputJsonValue) || Prisma.JsonNull,
        },
        update: {
          value: config.value,
          displayName: config.displayName,
          description: config.description,
          isSecret: config.isSecret,
          isActive: config.isActive,
          metadata: (config.metadata as Prisma.InputJsonValue) || Prisma.JsonNull,
        },
      });
      restoredCount++;
    }

    await this.cacheService.invalidate(CACHE_NAMESPACE, CACHE_NAMESPACE);

    await this.auditService.logAction({
      userId,
      action: 'platform_config.restore',
      resource: 'platform_config',
      metadata: { restoredCount },
    });

    return { restoredCount };
  }

  private maskValue(_value: string): string {
    // Always return a fixed mask. The stored value is ciphertext, so showing
    // trailing characters would leak ciphertext fragments rather than meaningful
    // plaintext hints.
    return '****';
  }

  private async invalidateCache(category: ConfigCategory, key: string) {
    await Promise.all([
      this.cacheService.del(`category:${category}`, CACHE_NAMESPACE),
      this.cacheService.del(`config:${category}:${key}`, CACHE_NAMESPACE),
    ]);
  }

  // Placeholder format validations. These methods check input format only and do NOT
  // perform actual network connectivity tests (e.g., calling the provider API).
  // Actual connectivity testing is a future enhancement.
  private async testAiProvider(_key: string, value: string) {
    // Validate key format (basic check)
    if (!value || value.length < 10) {
      return { success: false, message: 'API key appears to be too short' };
    }
    return { success: true, message: 'API key format is valid' };
  }

  private async testEmailProvider(_key: string, value: string) {
    if (!value || value.length < 5) {
      return { success: false, message: 'Invalid email provider credentials' };
    }
    return { success: true, message: 'Email provider credentials format is valid' };
  }

  private async testDatabaseConnection(_key: string, value: string) {
    if (!value || !value.includes('://')) {
      return { success: false, message: 'Invalid database connection string format' };
    }
    return { success: true, message: 'Database connection string format is valid' };
  }
}
