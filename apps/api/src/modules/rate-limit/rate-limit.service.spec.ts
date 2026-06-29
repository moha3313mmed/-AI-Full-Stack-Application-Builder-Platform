import { Test, TestingModule } from '@nestjs/testing';

import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  let service: RateLimitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RateLimitService],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('consume', () => {
    const config = { points: 3, duration: 60 };

    it('should allow requests within the limit', async () => {
      const result = await service.consume('test-key', config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
      expect(result.total).toBe(3);
    });

    it('should track consumed points', async () => {
      await service.consume('test-key', config);
      await service.consume('test-key', config);
      const result = await service.consume('test-key', config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('should deny requests exceeding the limit', async () => {
      await service.consume('test-key', config);
      await service.consume('test-key', config);
      await service.consume('test-key', config);

      const result = await service.consume('test-key', config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track different keys independently', async () => {
      await service.consume('key-1', config);
      await service.consume('key-1', config);
      await service.consume('key-1', config);

      const result = await service.consume('key-2', config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should include resetAt timestamp', async () => {
      const before = Date.now();
      const result = await service.consume('test-key', config);
      const after = Date.now();

      expect(result.resetAt).toBeGreaterThanOrEqual(
        before + config.duration * 1000,
      );
      expect(result.resetAt).toBeLessThanOrEqual(
        after + config.duration * 1000,
      );
    });
  });

  describe('get', () => {
    const config = { points: 5, duration: 60 };

    it('should return current state without consuming', async () => {
      await service.consume('test-key', config);

      const result = await service.get('test-key', config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);

      // Getting should not consume another point
      const result2 = await service.get('test-key', config);
      expect(result2.remaining).toBe(4);
    });

    it('should return full capacity for unknown key', async () => {
      const result = await service.get('unknown-key', config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
    });
  });

  describe('reset', () => {
    const config = { points: 3, duration: 60 };

    it('should reset rate limit for a key', async () => {
      await service.consume('test-key', config);
      await service.consume('test-key', config);
      await service.consume('test-key', config);

      await service.reset('test-key');

      const result = await service.consume('test-key', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });
  });

  describe('buildKey', () => {
    it('should build a key from userId and route', () => {
      const key = service.buildKey('user-123', 'GET:/api/projects');
      expect(key).toBe('rate_limit:user-123:GET:/api/projects');
    });
  });

  describe('sliding window', () => {
    it('should expire old entries after duration', async () => {
      const config = { points: 2, duration: 1 }; // 1 second window

      await service.consume('test-key', config);
      await service.consume('test-key', config);

      // Should be at limit
      let result = await service.consume('test-key', config);
      expect(result.allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be allowed again
      result = await service.consume('test-key', config);
      expect(result.allowed).toBe(true);
    });
  });
});
