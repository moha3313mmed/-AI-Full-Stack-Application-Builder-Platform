import { describe, it, expect, vi, beforeEach } from 'vitest';

import { CacheInvalidation } from '../cache-invalidation';

const mockRedis = {
  smembers: vi.fn(),
  sadd: vi.fn(),
  srem: vi.fn(),
  del: vi.fn(),
  scan: vi.fn(),
  pipeline: vi.fn().mockReturnValue({
    sadd: vi.fn().mockReturnThis(),
    srem: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  }),
};

describe('CacheInvalidation', () => {
  let invalidation: CacheInvalidation;

  beforeEach(() => {
    vi.clearAllMocks();
    invalidation = new CacheInvalidation(mockRedis as never);
  });

  describe('registerTaggedKey', () => {
    it('should register a key with multiple tags', async () => {
      const mockPipeline = {
        sadd: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      await invalidation.registerTaggedKey('user:1', ['users', 'active']);

      expect(mockPipeline.sadd).toHaveBeenCalledWith('__tag:users', 'user:1');
      expect(mockPipeline.sadd).toHaveBeenCalledWith('__tag:active', 'user:1');
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should register a key with a single tag', async () => {
      const mockPipeline = {
        sadd: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      await invalidation.registerTaggedKey('post:42', ['posts']);

      expect(mockPipeline.sadd).toHaveBeenCalledWith('__tag:posts', 'post:42');
      expect(mockPipeline.exec).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidateByTags', () => {
    it('should delete all keys associated with the given tags', async () => {
      mockRedis.smembers.mockResolvedValue(['user:1', 'user:2', 'user:3']);
      mockRedis.del.mockResolvedValue(3);

      const deleted = await invalidation.invalidateByTags(['users']);

      expect(mockRedis.smembers).toHaveBeenCalledWith('__tag:users');
      expect(mockRedis.del).toHaveBeenCalledWith('user:1', 'user:2', 'user:3');
      // Also deletes the tag key itself
      expect(mockRedis.del).toHaveBeenCalledWith('__tag:users');
      expect(deleted).toBe(3);
    });

    it('should handle multiple tags', async () => {
      mockRedis.smembers
        .mockResolvedValueOnce(['user:1'])
        .mockResolvedValueOnce(['post:1', 'post:2']);
      mockRedis.del
        .mockResolvedValueOnce(1) // keys for 'users'
        .mockResolvedValueOnce(1) // tag key '__tag:users'
        .mockResolvedValueOnce(2) // keys for 'posts'
        .mockResolvedValueOnce(1); // tag key '__tag:posts'

      const deleted = await invalidation.invalidateByTags(['users', 'posts']);
      expect(deleted).toBe(3); // 1 + 2 from key deletions
    });

    it('should handle empty tag sets gracefully', async () => {
      mockRedis.smembers.mockResolvedValue([]);

      const deleted = await invalidation.invalidateByTags(['empty-tag']);

      expect(deleted).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('invalidateByPattern', () => {
    it('should delete keys matching the pattern using scan', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', ['session:1', 'session:2']]);
      mockRedis.del.mockResolvedValue(2);

      const deleted = await invalidation.invalidateByPattern('session:*');

      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'session:*',
        'COUNT',
        100,
      );
      expect(mockRedis.del).toHaveBeenCalledWith('session:1', 'session:2');
      expect(deleted).toBe(2);
    });

    it('should iterate through cursor until done', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['42', ['key:1', 'key:2']])
        .mockResolvedValueOnce(['0', ['key:3']]);
      mockRedis.del.mockResolvedValue(2).mockResolvedValueOnce(2).mockResolvedValueOnce(1);

      const deleted = await invalidation.invalidateByPattern('key:*');

      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(deleted).toBe(3);
    });

    it('should handle no matching keys', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', []]);

      const deleted = await invalidation.invalidateByPattern('nonexistent:*');

      expect(deleted).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('getKeysByTag', () => {
    it('should return all keys for a specific tag', async () => {
      mockRedis.smembers.mockResolvedValue(['user:1', 'user:2']);

      const keys = await invalidation.getKeysByTag('users');

      expect(keys).toEqual(['user:1', 'user:2']);
      expect(mockRedis.smembers).toHaveBeenCalledWith('__tag:users');
    });

    it('should return empty array for unknown tag', async () => {
      mockRedis.smembers.mockResolvedValue([]);

      const keys = await invalidation.getKeysByTag('unknown');
      expect(keys).toEqual([]);
    });
  });

  describe('unregisterKey', () => {
    it('should remove a key from all its tags', async () => {
      const mockPipeline = {
        srem: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockRedis.pipeline.mockReturnValue(mockPipeline);

      await invalidation.unregisterKey('user:1', ['users', 'active']);

      expect(mockPipeline.srem).toHaveBeenCalledWith('__tag:users', 'user:1');
      expect(mockPipeline.srem).toHaveBeenCalledWith('__tag:active', 'user:1');
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });
});
