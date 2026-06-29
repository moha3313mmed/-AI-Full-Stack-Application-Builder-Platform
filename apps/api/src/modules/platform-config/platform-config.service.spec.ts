import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '../audit/audit.service';
import { AppCacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

import { CreateConfigDto } from './dto/create-config.dto';
import { EncryptionService } from './encryption.service';
import { PlatformConfigService } from './platform-config.service';

describe('PlatformConfigService', () => {
  let service: PlatformConfigService;

  const mockPrismaService = {
    platformConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    invalidate: jest.fn(),
    getOrSet: jest.fn(),
  };

  const mockAuditService = {
    logAction: jest.fn(),
  };

  const mockEncryptionService = {
    encrypt: jest.fn().mockReturnValue('encrypted-value'),
    decrypt: jest.fn().mockReturnValue('decrypted-value'),
    rotateEncryption: jest.fn().mockReturnValue('rotated-encrypted-value'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformConfigService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AppCacheService, useValue: mockCacheService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: EncryptionService, useValue: mockEncryptionService },
      ],
    }).compile();

    service = module.get<PlatformConfigService>(PlatformConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllByCategory', () => {
    it('should return cached results if available', async () => {
      const cachedData = [{ id: '1', key: 'test', value: '****' }];
      mockCacheService.get.mockResolvedValue(cachedData);

      const result = await service.getAllByCategory('AI_PROVIDERS' as any);

      expect(result).toEqual(cachedData);
      expect(mockPrismaService.platformConfig.findMany).not.toHaveBeenCalled();
    });

    it('should query database and mask secrets when cache is empty', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.platformConfig.findMany.mockResolvedValue([
        {
          id: '1',
          category: 'AI_PROVIDERS',
          key: 'openai_key',
          value: 'sk-encrypted-longvalue1234',
          displayName: 'OpenAI API Key',
          isSecret: true,
          isActive: true,
          metadata: {},
        },
        {
          id: '2',
          category: 'AI_PROVIDERS',
          key: 'model_name',
          value: 'gpt-4',
          displayName: 'Default Model',
          isSecret: false,
          isActive: true,
          metadata: {},
        },
      ]);

      const result = await service.getAllByCategory('AI_PROVIDERS' as any);

      expect(result).toHaveLength(2);
      // Secret value should be masked
      expect((result[0] as any).value).toBe('****');
      // Non-secret value should be shown as-is
      expect((result[1] as any).value).toBe('gpt-4');
      // Should cache the results
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'category:AI_PROVIDERS',
        expect.any(Array),
        { ttl: 300, namespace: 'platform-config' },
      );
    });
  });

  describe('getOne', () => {
    it('should return cached config if available', async () => {
      const cachedConfig = { id: '1', key: 'test', value: '****' };
      mockCacheService.get.mockResolvedValue(cachedConfig);

      const result = await service.getOne('AI_PROVIDERS' as any, 'test');

      expect(result).toEqual(cachedConfig);
    });

    it('should throw NotFoundException when config does not exist', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.platformConfig.findUnique.mockResolvedValue(null);

      await expect(service.getOne('AI_PROVIDERS' as any, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should mask secret value from database', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.platformConfig.findUnique.mockResolvedValue({
        id: '1',
        category: 'AI_PROVIDERS',
        key: 'openai_key',
        value: 'sk-encrypted-longvalue5678',
        displayName: 'OpenAI API Key',
        isSecret: true,
        isActive: true,
        metadata: {},
      });

      const result = await service.getOne('AI_PROVIDERS' as any, 'openai_key');

      expect((result as any).value).toBe('****');
    });
  });

  describe('upsert', () => {
    it('should encrypt value, save to DB, invalidate cache, and log audit', async () => {
      const dto: CreateConfigDto = {
        category: 'AI_PROVIDERS' as any,
        key: 'openai_key',
        value: 'sk-test-key-12345678',
        displayName: 'OpenAI API Key',
        isSecret: true,
      };

      mockPrismaService.platformConfig.upsert.mockResolvedValue({
        id: 'config-1',
        category: 'AI_PROVIDERS',
        key: 'openai_key',
        value: 'encrypted-value',
        displayName: 'OpenAI API Key',
        isSecret: true,
        isActive: true,
        metadata: {},
      });

      const result = await service.upsert(dto, 'user-123');

      // Should encrypt the value
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('sk-test-key-12345678');
      // Should save to DB
      expect(mockPrismaService.platformConfig.upsert).toHaveBeenCalled();
      // Should invalidate cache
      expect(mockCacheService.del).toHaveBeenCalledWith(
        'category:AI_PROVIDERS',
        'platform-config',
      );
      expect(mockCacheService.del).toHaveBeenCalledWith(
        'config:AI_PROVIDERS:openai_key',
        'platform-config',
      );
      // Should log audit
      expect(mockAuditService.logAction).toHaveBeenCalledWith({
        userId: 'user-123',
        action: 'platform_config.upsert',
        resource: 'platform_config',
        resourceId: 'config-1',
        metadata: { category: 'AI_PROVIDERS', key: 'openai_key' },
      });
      // Should return masked value
      expect(result.value).toBe('****');
    });

    it('should not encrypt non-secret values', async () => {
      const dto: CreateConfigDto = {
        category: 'AI_PROVIDERS' as any,
        key: 'model_name',
        value: 'gpt-4',
        displayName: 'Default Model',
        isSecret: false,
      };

      mockPrismaService.platformConfig.upsert.mockResolvedValue({
        id: 'config-2',
        category: 'AI_PROVIDERS',
        key: 'model_name',
        value: 'gpt-4',
        displayName: 'Default Model',
        isSecret: false,
        isActive: true,
        metadata: {},
      });

      await service.upsert(dto, 'user-123');

      expect(mockEncryptionService.encrypt).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete config, invalidate cache, and log audit', async () => {
      mockPrismaService.platformConfig.findUnique.mockResolvedValue({
        id: 'config-1',
        category: 'AI_PROVIDERS',
        key: 'openai_key',
      });

      const result = await service.delete('AI_PROVIDERS' as any, 'openai_key', 'user-123');

      expect(result).toEqual({ success: true });
      expect(mockPrismaService.platformConfig.delete).toHaveBeenCalledWith({
        where: { category_key: { category: 'AI_PROVIDERS', key: 'openai_key' } },
      });
      // Should invalidate cache
      expect(mockCacheService.del).toHaveBeenCalledWith(
        'category:AI_PROVIDERS',
        'platform-config',
      );
      expect(mockCacheService.del).toHaveBeenCalledWith(
        'config:AI_PROVIDERS:openai_key',
        'platform-config',
      );
      // Should log audit
      expect(mockAuditService.logAction).toHaveBeenCalledWith({
        userId: 'user-123',
        action: 'platform_config.delete',
        resource: 'platform_config',
        resourceId: 'config-1',
        metadata: { category: 'AI_PROVIDERS', key: 'openai_key' },
      });
    });

    it('should throw NotFoundException when config does not exist', async () => {
      mockPrismaService.platformConfig.findUnique.mockResolvedValue(null);

      await expect(
        service.delete('AI_PROVIDERS' as any, 'nonexistent', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('testConnection', () => {
    it('should validate AI provider key format', async () => {
      const result = await service.testConnection(
        'AI_PROVIDERS' as any,
        'openai_key',
        'sk-test-1234567890abcdefg',
      );

      expect(result.success).toBe(true);
    });

    it('should reject short AI provider keys', async () => {
      const result = await service.testConnection(
        'AI_PROVIDERS' as any,
        'openai_key',
        'short',
      );

      expect(result.success).toBe(false);
    });

    it('should validate database connection string format', async () => {
      const result = await service.testConnection(
        'DATABASES' as any,
        'postgres',
        'postgresql://localhost:5432/mydb',
      );

      expect(result.success).toBe(true);
    });

    it('should reject invalid database connection strings', async () => {
      const result = await service.testConnection(
        'DATABASES' as any,
        'postgres',
        'invalid-string',
      );

      expect(result.success).toBe(false);
    });

    it('should fetch and decrypt stored value when no value is provided', async () => {
      mockPrismaService.platformConfig.findUnique.mockResolvedValue({
        id: '1',
        category: 'AI_PROVIDERS',
        key: 'openai_key',
        value: 'encrypted-stored-value',
        isSecret: true,
        isActive: true,
      });
      mockEncryptionService.decrypt.mockReturnValue('sk-long-stored-key-1234567890');

      const result = await service.testConnection(
        'AI_PROVIDERS' as any,
        'openai_key',
        undefined,
      );

      expect(mockPrismaService.platformConfig.findUnique).toHaveBeenCalledWith({
        where: { category_key: { category: 'AI_PROVIDERS', key: 'openai_key' } },
      });
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('encrypted-stored-value');
      expect(result.success).toBe(true);
    });

    it('should return failure when no value provided and no stored config exists', async () => {
      mockPrismaService.platformConfig.findUnique.mockResolvedValue(null);

      const result = await service.testConnection(
        'AI_PROVIDERS' as any,
        'openai_key',
        undefined,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('No stored configuration found');
    });
  });

  describe('backup and restore', () => {
    it('should export all configs as encrypted backup', async () => {
      mockPrismaService.platformConfig.findMany.mockResolvedValue([
        {
          id: '1',
          category: 'AI_PROVIDERS',
          key: 'openai_key',
          value: 'encrypted-val',
          displayName: 'OpenAI',
          description: null,
          isSecret: true,
          isActive: true,
          metadata: {},
        },
      ]);

      const result = await service.backup('user-123');

      expect(result.version).toBe(1);
      expect(result.configs).toHaveLength(1);
      expect(result.configs[0].value).toBe('encrypted-val');
      expect(mockAuditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'platform_config.backup',
        }),
      );
    });

    it('should restore configs from backup', async () => {
      const backup = {
        version: 1,
        configs: [
          {
            category: 'AI_PROVIDERS' as any,
            key: 'openai_key',
            value: 'encrypted-val',
            displayName: 'OpenAI',
            description: null,
            isSecret: true,
            isActive: true,
            metadata: {},
          },
        ],
      };

      mockPrismaService.platformConfig.upsert.mockResolvedValue({});

      const result = await service.restore(backup, 'user-123');

      expect(result.restoredCount).toBe(1);
      expect(mockPrismaService.platformConfig.upsert).toHaveBeenCalledTimes(1);
      expect(mockCacheService.invalidate).toHaveBeenCalledWith(
        'platform-config',
        'platform-config',
      );
      expect(mockAuditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'platform_config.restore',
        }),
      );
    });
  });

  describe('rotateKey', () => {
    it('should rotate encryption for all secret configs in a transaction', async () => {
      mockPrismaService.platformConfig.findMany.mockResolvedValue([
        { id: '1', value: 'old-encrypted-1', isSecret: true },
        { id: '2', value: 'old-encrypted-2', isSecret: true },
      ]);
      mockPrismaService.platformConfig.update.mockResolvedValue({});
      mockPrismaService.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.rotateKey('old-key', 'new-key', 'user-123');

      expect(result.rotatedCount).toBe(2);
      expect(result.totalConfigs).toBe(2);
      expect(mockEncryptionService.rotateEncryption).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.$transaction).toHaveBeenCalledWith(
        expect.arrayContaining([expect.anything(), expect.anything()]),
      );
      expect(mockAuditService.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'platform_config.rotate_key',
        }),
      );
    });
  });
});
