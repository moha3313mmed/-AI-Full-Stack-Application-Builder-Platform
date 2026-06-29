import { describe, it, expect, vi, beforeEach } from 'vitest';

import { CacheService } from '../cache.service';

// Mock ioredis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  flushdb: vi.fn(),
  scan: vi.fn(),
  quit: vi.fn(),
  pipeline: vi.fn().mockReturnValue({
    sadd: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  }),
};

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => mockRedis),
  };
});

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = CacheService.fromClient(mockRedis as never, {
      defaultTtl: 3600,
      keyPrefix: '',
    });
  });

  describe('get', () => {
    it('should return the cached value', async () => {
      const entry = {
        value: { name: 'test' },
        createdAt: Date.now(),
        ttl: 3600,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(entry));

      const result = await service.get('my-key');
      expect(result).toEqual({ name: 'test' });
      expect(mockRedis.get).toHaveBeenCalledWith('my-key');
    });

    it('should return null if key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get('missing-key');
      expect(result).toBeNull();
    });

    it('should support namespaced keys', async () => {
      const entry = {
        value: 'value',
        createdAt: Date.now(),
        ttl: 3600,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(entry));

      const result = await service.get('user:123', 'api');
      expect(result).toBe('value');
      expect(mockRedis.get).toHaveBeenCalledWith('api:user:123');
    });

    it('should return null for invalid JSON', async () => {
      mockRedis.get.mockResolvedValue('not-valid-json{{{');

      const result = await service.get('bad-key');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set a value with default TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await service.set('key', { data: 'value' });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'key',
        3600,
        expect.any(String),
      );
    });

    it('should set a value with custom TTL', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await service.set('key', 'value', { ttl: 60 });

      expect(mockRedis.setex).toHaveBeenCalledWith('key', 60, expect.any(String));
    });

    it('should set a value without expiry when ttl is 0', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.set('key', 'permanent', { ttl: 0 });

      expect(mockRedis.set).toHaveBeenCalledWith('key', expect.any(String));
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should support namespaced keys', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await service.set('session:abc', 'data', { namespace: 'auth' });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'auth:session:abc',
        3600,
        expect.any(String),
      );
    });

    it('should register tags when provided', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      const mockPipeline = {
        sadd: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      await service.set('user:1', { name: 'Alice' }, { tags: ['users', 'active'] });

      expect(mockPipeline.sadd).toHaveBeenCalledWith('__tag:users', 'user:1');
      expect(mockPipeline.sadd).toHaveBeenCalledWith('__tag:active', 'user:1');
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  describe('del', () => {
    it('should delete a key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.del('key');
      expect(mockRedis.del).toHaveBeenCalledWith('key');
    });

    it('should delete a namespaced key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.del('item', 'api');
      expect(mockRedis.del).toHaveBeenCalledWith('api:item');
    });
  });

  describe('exists', () => {
    it('should return true if key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await service.exists('key');
      expect(result).toBe(true);
    });

    it('should return false if key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await service.exists('missing');
      expect(result).toBe(false);
    });

    it('should check namespaced key', async () => {
      mockRedis.exists.mockResolvedValue(1);

      await service.exists('item', 'cache');
      expect(mockRedis.exists).toHaveBeenCalledWith('cache:item');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const entry = { value: 'cached', createdAt: Date.now(), ttl: 3600 };
      mockRedis.get.mockResolvedValue(JSON.stringify(entry));

      const factory = vi.fn().mockResolvedValue('fresh');
      const result = await service.getOrSet('key', factory);

      expect(result).toBe('cached');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if key is missing', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const factory = vi.fn().mockResolvedValue({ fresh: true });
      const result = await service.getOrSet('key', factory, { ttl: 120 });

      expect(result).toEqual({ fresh: true });
      expect(factory).toHaveBeenCalled();
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should support namespace in options', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue('OK');

      const factory = vi.fn().mockResolvedValue('result');
      await service.getOrSet('item', factory, { namespace: 'api' });

      expect(mockRedis.get).toHaveBeenCalledWith('api:item');
    });
  });

  describe('flush', () => {
    it('should flush the entire database', async () => {
      mockRedis.flushdb.mockResolvedValue('OK');

      await service.flush();
      expect(mockRedis.flushdb).toHaveBeenCalled();
    });
  });

  describe('flushByPrefix', () => {
    it('should delete all keys matching the prefix', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['0', ['session:1', 'session:2']])
      mockRedis.del.mockResolvedValue(2);

      await service.flushByPrefix('session:');

      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'session:*',
        'COUNT',
        100,
      );
      expect(mockRedis.del).toHaveBeenCalledWith('session:1', 'session:2');
    });

    it('should handle empty results', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', []]);

      await service.flushByPrefix('empty:');
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should support namespace with prefix', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', ['api:user:1']]);
      mockRedis.del.mockResolvedValue(1);

      await service.flushByPrefix('user:', 'api');

      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'api:user:*',
        'COUNT',
        100,
      );
    });
  });

  describe('disconnect', () => {
    it('should close the Redis connection', async () => {
      mockRedis.quit.mockResolvedValue('OK');

      await service.disconnect();
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
