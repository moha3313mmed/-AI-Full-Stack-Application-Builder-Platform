import { describe, it, expect, beforeEach } from 'vitest';

import { HealthChecker } from '../health';

describe('HealthChecker', () => {
  let checker: HealthChecker;

  beforeEach(() => {
    checker = new HealthChecker();
  });

  describe('registerCheck', () => {
    it('should register a health check', () => {
      checker.registerCheck('database', async () => ({ status: 'up' }));
      expect(checker.getRegisteredChecks()).toContain('database');
    });

    it('should allow registering multiple checks', () => {
      checker.registerCheck('database', async () => ({ status: 'up' }));
      checker.registerCheck('redis', async () => ({ status: 'up' }));
      checker.registerCheck('storage', async () => ({ status: 'up' }));

      expect(checker.getRegisteredChecks()).toHaveLength(3);
    });

    it('should override existing check with same name', () => {
      checker.registerCheck('database', async () => ({ status: 'down' }));
      checker.registerCheck('database', async () => ({ status: 'up' }));

      expect(checker.getRegisteredChecks()).toHaveLength(1);
    });
  });

  describe('removeCheck', () => {
    it('should remove a registered check', () => {
      checker.registerCheck('database', async () => ({ status: 'up' }));
      checker.removeCheck('database');
      expect(checker.getRegisteredChecks()).toHaveLength(0);
    });
  });

  describe('runAll', () => {
    it('should return healthy when all checks are up', async () => {
      checker.registerCheck('database', async () => ({ status: 'up' }));
      checker.registerCheck('redis', async () => ({ status: 'up' }));

      const result = await checker.runAll();

      expect(result.status).toBe('healthy');
      expect(result.checks).toHaveLength(2);
      expect(result.checks[0].status).toBe('up');
      expect(result.checks[1].status).toBe('up');
      expect(result.timestamp).toBeDefined();
    });

    it('should return unhealthy when all checks are down', async () => {
      checker.registerCheck('database', async () => ({
        status: 'down',
        error: 'Connection refused',
      }));
      checker.registerCheck('redis', async () => ({
        status: 'down',
        error: 'Timeout',
      }));

      const result = await checker.runAll();

      expect(result.status).toBe('unhealthy');
      expect(result.checks[0].error).toBe('Connection refused');
      expect(result.checks[1].error).toBe('Timeout');
    });

    it('should return degraded when some checks are up and some are down', async () => {
      checker.registerCheck('database', async () => ({ status: 'up' }));
      checker.registerCheck('redis', async () => ({
        status: 'down',
        error: 'Not connected',
      }));

      const result = await checker.runAll();

      expect(result.status).toBe('degraded');
    });

    it('should handle check functions that throw', async () => {
      checker.registerCheck('failing', async () => {
        throw new Error('Unexpected error');
      });

      const result = await checker.runAll();

      expect(result.status).toBe('unhealthy');
      expect(result.checks[0].status).toBe('down');
      expect(result.checks[0].error).toBe('Unexpected error');
    });

    it('should include latency from check result', async () => {
      checker.registerCheck('database', async () => ({
        status: 'up',
        latency: 5,
      }));

      const result = await checker.runAll();

      expect(result.checks[0].latency).toBe(5);
    });

    it('should measure latency when check does not provide it', async () => {
      checker.registerCheck('slow', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { status: 'up' };
      });

      const result = await checker.runAll();

      expect(result.checks[0].latency).toBeGreaterThanOrEqual(40);
    });

    it('should return healthy with empty checks', async () => {
      const result = await checker.runAll();

      expect(result.status).toBe('healthy');
      expect(result.checks).toHaveLength(0);
    });

    it('should include a valid ISO timestamp', async () => {
      checker.registerCheck('test', async () => ({ status: 'up' }));
      const result = await checker.runAll();

      const parsed = new Date(result.timestamp);
      expect(parsed.toISOString()).toBe(result.timestamp);
    });

    it('should not include error field for successful checks', async () => {
      checker.registerCheck('healthy', async () => ({ status: 'up' }));

      const result = await checker.runAll();

      expect(result.checks[0].error).toBeUndefined();
    });
  });
});
