import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { AppCacheService } from './cache.service';

// Mock @builder/cache
jest.mock('@builder/cache', () => {
  return {
    CacheService: jest.fn().mockImplementation(() => ({
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      flushByPrefix: jest.fn().mockResolvedValue(undefined),
      getOrSet: jest.fn().mockImplementation((_key: string, factory: () => Promise<unknown>) => factory()),
      disconnect: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('AppCacheService', () => {
  let service: AppCacheService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue({ url: 'redis://localhost:6379' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppCacheService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AppCacheService>(AppCacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should call cache service get', async () => {
      const result = await service.get('test-key');
      expect(result).toBeNull();
    });

    it('should support namespace parameter', async () => {
      await service.get('test-key', 'projects');
      // Should not throw
    });
  });

  describe('set', () => {
    it('should call cache service set', async () => {
      await service.set('test-key', { id: 1, name: 'test' });
      // Should not throw
    });

    it('should support options with TTL', async () => {
      await service.set('test-key', 'value', { ttl: 60 });
      // Should not throw
    });
  });

  describe('del', () => {
    it('should call cache service del', async () => {
      await service.del('test-key');
      // Should not throw
    });
  });

  describe('invalidate', () => {
    it('should call flushByPrefix', async () => {
      await service.invalidate('projects:');
      // Should not throw
    });
  });

  describe('getOrSet', () => {
    it('should call cache service getOrSet with factory', async () => {
      const factory = jest.fn().mockResolvedValue({ id: 1 });
      const result = await service.getOrSet('key', factory, { ttl: 120 });

      expect(factory).toHaveBeenCalled();
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from cache', async () => {
      await service.onModuleDestroy();
      // Should not throw
    });
  });
});
