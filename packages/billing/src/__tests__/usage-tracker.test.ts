import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PlanService } from '../plans';
import { PlanTier, UsageMetric } from '../types';
import { UsageStore, UsageTracker } from '../usage-tracker';

describe('UsageTracker', () => {
  let usageTracker: UsageTracker;
  let mockStore: UsageStore;

  beforeEach(() => {
    mockStore = {
      recordUsage: vi.fn().mockResolvedValue(undefined),
      getUsage: vi.fn().mockResolvedValue(0),
    };
    usageTracker = new UsageTracker(mockStore, new PlanService());
  });

  describe('recordUsage', () => {
    it('should record usage data to the store', async () => {
      const usageData = {
        userId: 'user-1',
        metric: UsageMetric.API_CALLS,
        value: 5,
        period: '2024-01',
      };

      await usageTracker.recordUsage(usageData);

      expect(mockStore.recordUsage).toHaveBeenCalledWith(usageData);
    });

    it('should record usage with organization', async () => {
      const usageData = {
        userId: 'user-1',
        organizationId: 'org-1',
        metric: UsageMetric.DEPLOYMENTS,
        value: 1,
        period: '2024-03',
      };

      await usageTracker.recordUsage(usageData);

      expect(mockStore.recordUsage).toHaveBeenCalledWith(usageData);
    });
  });

  describe('getUsage', () => {
    it('should return current usage from store', async () => {
      vi.mocked(mockStore.getUsage).mockResolvedValue(42);

      const result = await usageTracker.getUsage(
        'user-1',
        UsageMetric.API_CALLS,
        '2024-01',
      );

      expect(result).toBe(42);
      expect(mockStore.getUsage).toHaveBeenCalledWith(
        'user-1',
        UsageMetric.API_CALLS,
        '2024-01',
      );
    });

    it('should return 0 when no usage recorded', async () => {
      vi.mocked(mockStore.getUsage).mockResolvedValue(0);

      const result = await usageTracker.getUsage(
        'user-1',
        UsageMetric.DEPLOYMENTS,
        '2024-01',
      );

      expect(result).toBe(0);
    });
  });

  describe('checkQuota', () => {
    it('should allow when under limit', async () => {
      vi.mocked(mockStore.getUsage).mockResolvedValue(2);

      const result = await usageTracker.checkQuota(
        'user-1',
        UsageMetric.PROJECTS,
        '2024-01',
        PlanTier.FREE,
      );

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(2);
      expect(result.limit).toBe(3); // FREE tier max projects
      expect(result.remaining).toBe(1);
    });

    it('should deny when at limit', async () => {
      vi.mocked(mockStore.getUsage).mockResolvedValue(3);

      const result = await usageTracker.checkQuota(
        'user-1',
        UsageMetric.PROJECTS,
        '2024-01',
        PlanTier.FREE,
      );

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(3);
      expect(result.limit).toBe(3);
      expect(result.remaining).toBe(0);
    });

    it('should deny when over limit', async () => {
      vi.mocked(mockStore.getUsage).mockResolvedValue(5);

      const result = await usageTracker.checkQuota(
        'user-1',
        UsageMetric.PROJECTS,
        '2024-01',
        PlanTier.FREE,
      );

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(5);
      expect(result.limit).toBe(3);
      expect(result.remaining).toBe(0);
    });

    it('should always allow for unlimited (-1) enterprise plan', async () => {
      vi.mocked(mockStore.getUsage).mockResolvedValue(99999);

      const result = await usageTracker.checkQuota(
        'user-1',
        UsageMetric.PROJECTS,
        '2024-01',
        PlanTier.ENTERPRISE,
      );

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(99999);
      expect(result.limit).toBe(-1);
      expect(result.remaining).toBe(-1);
    });

    it('should check API calls quota correctly', async () => {
      vi.mocked(mockStore.getUsage).mockResolvedValue(500);

      const result = await usageTracker.checkQuota(
        'user-1',
        UsageMetric.API_CALLS,
        '2024-01',
        PlanTier.FREE,
      );

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(1000);
      expect(result.remaining).toBe(500);
    });

    it('should check AI tokens quota', async () => {
      vi.mocked(mockStore.getUsage).mockResolvedValue(10000);

      const result = await usageTracker.checkQuota(
        'user-1',
        UsageMetric.AI_TOKENS,
        '2024-01',
        PlanTier.FREE,
      );

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(10000);
      expect(result.remaining).toBe(0);
    });
  });

  describe('getCurrentPeriod', () => {
    it('should return current year-month format', () => {
      const period = usageTracker.getCurrentPeriod();
      expect(period).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});
