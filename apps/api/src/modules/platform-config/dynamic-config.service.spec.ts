import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { AppCacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

import { DynamicConfigService } from './dynamic-config.service';
import { EncryptionService } from './encryption.service';

describe('DynamicConfigService', () => {
  let service: DynamicConfigService;

  const mockPrismaService = {
    platformConfig: {
      findUnique: jest.fn(),
    },
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockEncryptionService = {
    decrypt: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DynamicConfigService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AppCacheService, useValue: mockCacheService },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<DynamicConfigService>(DynamicConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConfigValue', () => {
    it('should return cached value when cache hit occurs', async () => {
      mockCacheService.get.mockResolvedValue('cached-api-key');

      const result = await service.getConfigValue('AI_PROVIDERS' as any, 'openai_api_key');

      expect(result).toBe('cached-api-key');
      expect(mockCacheService.get).toHaveBeenCalledWith(
        'dynamic:AI_PROVIDERS:openai_api_key',
        'platform-config',
      );
      expect(mockPrismaService.platformConfig.findUnique).not.toHaveBeenCalled();
    });

    it('should query DB and decrypt when cache miss on a secret config', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.platformConfig.findUnique.mockResolvedValue({
        id: '1',
        category: 'AI_PROVIDERS',
        key: 'openai_api_key',
        value: 'encrypted-value',
        isSecret: true,
        isActive: true,
      });
      mockEncryptionService.decrypt.mockReturnValue('sk-decrypted-key');

      const result = await service.getConfigValue('AI_PROVIDERS' as any, 'openai_api_key');

      expect(result).toBe('sk-decrypted-key');
      expect(mockPrismaService.platformConfig.findUnique).toHaveBeenCalledWith({
        where: { category_key: { category: 'AI_PROVIDERS', key: 'openai_api_key' } },
      });
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('encrypted-value');
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'dynamic:AI_PROVIDERS:openai_api_key',
        'sk-decrypted-key',
        { ttl: 300, namespace: 'platform-config' },
      );
    });

    it('should return non-secret value without decrypting', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.platformConfig.findUnique.mockResolvedValue({
        id: '2',
        category: 'AI_PROVIDERS',
        key: 'ollama_url',
        value: 'http://localhost:11434',
        isSecret: false,
        isActive: true,
      });

      const result = await service.getConfigValue('AI_PROVIDERS' as any, 'ollama_url');

      expect(result).toBe('http://localhost:11434');
      expect(mockEncryptionService.decrypt).not.toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'dynamic:AI_PROVIDERS:ollama_url',
        'http://localhost:11434',
        { ttl: 300, namespace: 'platform-config' },
      );
    });

    it('should fall through to env when config is inactive', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.platformConfig.findUnique.mockResolvedValue({
        id: '1',
        category: 'AI_PROVIDERS',
        key: 'openai_api_key',
        value: 'encrypted-value',
        isSecret: true,
        isActive: false,
      });
      mockConfigService.get.mockReturnValue('env-fallback-key');

      const result = await service.getConfigValue('AI_PROVIDERS' as any, 'openai_api_key');

      expect(result).toBe('env-fallback-key');
      expect(mockEncryptionService.decrypt).not.toHaveBeenCalled();
      expect(mockConfigService.get).toHaveBeenCalledWith('OPENAI_API_KEY');
    });

    it('should fall through to env when decrypt fails', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.platformConfig.findUnique.mockResolvedValue({
        id: '1',
        category: 'AI_PROVIDERS',
        key: 'openai_api_key',
        value: 'corrupted-encrypted-value',
        isSecret: true,
        isActive: true,
      });
      mockEncryptionService.decrypt.mockImplementation(() => {
        throw new Error('Invalid encrypted value format');
      });
      mockConfigService.get.mockReturnValue('env-fallback-key');

      const result = await service.getConfigValue('AI_PROVIDERS' as any, 'openai_api_key');

      expect(result).toBe('env-fallback-key');
      expect(mockConfigService.get).toHaveBeenCalledWith('OPENAI_API_KEY');
    });

    it('should fall through to env when DB query fails', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.platformConfig.findUnique.mockRejectedValue(
        new Error('Database connection error'),
      );
      mockConfigService.get.mockReturnValue('env-fallback-key');

      const result = await service.getConfigValue('AI_PROVIDERS' as any, 'openai_api_key');

      expect(result).toBe('env-fallback-key');
      expect(mockConfigService.get).toHaveBeenCalledWith('OPENAI_API_KEY');
    });

    it('should return null when no DB config and no env var exists', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.platformConfig.findUnique.mockResolvedValue(null);
      mockConfigService.get.mockReturnValue(undefined);

      const result = await service.getConfigValue('AI_PROVIDERS' as any, 'openai_api_key');

      expect(result).toBeNull();
    });

    it('should fall through to env and return null when env var is not set', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrismaService.platformConfig.findUnique.mockResolvedValue({
        id: '1',
        category: 'AI_PROVIDERS',
        key: 'openai_api_key',
        value: 'corrupted',
        isSecret: true,
        isActive: true,
      });
      mockEncryptionService.decrypt.mockImplementation(() => {
        throw new Error('decrypt failed');
      });
      mockConfigService.get.mockReturnValue(undefined);

      const result = await service.getConfigValue('AI_PROVIDERS' as any, 'openai_api_key');

      expect(result).toBeNull();
    });
  });
});
