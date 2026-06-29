import { describe, it, expect, vi, beforeEach } from 'vitest';

import { BillingAdapter } from '../billing-adapter';
import { PlanService } from '../plans';
import {
  SubscriptionService,
  SubscriptionStore,
} from '../subscription.service';
import { PlanTier, SubscriptionData, SubscriptionStatus } from '../types';

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;
  let mockStore: SubscriptionStore;
  let mockAdapter: BillingAdapter;

  const mockSubscription: SubscriptionData = {
    id: 'sub-1',
    userId: 'user-1',
    planId: 'pro',
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: new Date('2024-01-01'),
    currentPeriodEnd: new Date('2024-02-01'),
    provider: 'stripe',
    metadata: {},
  };

  beforeEach(() => {
    mockStore = {
      createSubscription: vi.fn().mockResolvedValue(mockSubscription),
      getActiveSubscription: vi.fn().mockResolvedValue(null),
      cancelSubscription: vi.fn().mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.CANCELED,
      }),
    };

    mockAdapter = {
      createCustomer: vi.fn(),
      createSubscription: vi.fn(),
      cancelSubscription: vi.fn().mockResolvedValue(undefined),
      getSubscription: vi.fn(),
    };

    subscriptionService = new SubscriptionService(
      mockStore,
      new PlanService(),
      mockAdapter,
    );
  });

  describe('createSubscription', () => {
    it('should create a subscription with the correct plan', async () => {
      const result = await subscriptionService.createSubscription({
        userId: 'user-1',
        planTier: PlanTier.PRO,
        provider: 'stripe',
      });

      expect(result).toBeDefined();
      expect(mockStore.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          planId: 'pro',
          status: SubscriptionStatus.ACTIVE,
          provider: 'stripe',
        }),
      );
    });

    it('should include organization ID when provided', async () => {
      await subscriptionService.createSubscription({
        userId: 'user-1',
        organizationId: 'org-1',
        planTier: PlanTier.TEAM,
        provider: 'stripe',
      });

      expect(mockStore.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          organizationId: 'org-1',
          planId: 'team',
        }),
      );
    });

    it('should set period start and end dates', async () => {
      await subscriptionService.createSubscription({
        userId: 'user-1',
        planTier: PlanTier.FREE,
        provider: 'internal',
      });

      const call = vi.mocked(mockStore.createSubscription).mock.calls[0][0];
      expect(call.currentPeriodStart).toBeInstanceOf(Date);
      expect(call.currentPeriodEnd).toBeInstanceOf(Date);
      expect(call.currentPeriodEnd.getTime()).toBeGreaterThan(
        call.currentPeriodStart.getTime(),
      );
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription via adapter and store', async () => {
      const result = await subscriptionService.cancelSubscription('sub-1');

      expect(mockAdapter.cancelSubscription).toHaveBeenCalledWith('sub-1');
      expect(mockStore.cancelSubscription).toHaveBeenCalledWith(
        'sub-1',
        expect.any(Date),
      );
      expect(result.status).toBe(SubscriptionStatus.CANCELED);
    });

    it('should work without billing adapter', async () => {
      const serviceNoAdapter = new SubscriptionService(
        mockStore,
        new PlanService(),
      );

      await serviceNoAdapter.cancelSubscription('sub-1');

      expect(mockStore.cancelSubscription).toHaveBeenCalledWith(
        'sub-1',
        expect.any(Date),
      );
    });
  });

  describe('getActiveSubscription', () => {
    it('should return null when no active subscription', async () => {
      const result = await subscriptionService.getActiveSubscription('user-1');
      expect(result).toBeNull();
    });

    it('should return active subscription when exists', async () => {
      vi.mocked(mockStore.getActiveSubscription).mockResolvedValue(
        mockSubscription,
      );

      const result = await subscriptionService.getActiveSubscription('user-1');

      expect(result).toEqual(mockSubscription);
      expect(mockStore.getActiveSubscription).toHaveBeenCalledWith('user-1');
    });
  });

  describe('checkFeatureAccess', () => {
    it('should default to FREE tier when no subscription', async () => {
      vi.mocked(mockStore.getActiveSubscription).mockResolvedValue(null);

      const hasApiAccess = await subscriptionService.checkFeatureAccess(
        'user-1',
        'apiAccess',
      );
      expect(hasApiAccess).toBe(true);

      const hasCustomDomains = await subscriptionService.checkFeatureAccess(
        'user-1',
        'customDomains',
      );
      expect(hasCustomDomains).toBe(false);
    });

    it('should check features based on active subscription plan', async () => {
      vi.mocked(mockStore.getActiveSubscription).mockResolvedValue(
        mockSubscription,
      );

      const hasCustomDomains = await subscriptionService.checkFeatureAccess(
        'user-1',
        'customDomains',
      );
      expect(hasCustomDomains).toBe(true); // PRO tier

      const hasSso = await subscriptionService.checkFeatureAccess(
        'user-1',
        'ssoIntegration',
      );
      expect(hasSso).toBe(false); // PRO tier doesn't have SSO
    });

    it('should return false for unknown plan slug', async () => {
      vi.mocked(mockStore.getActiveSubscription).mockResolvedValue({
        ...mockSubscription,
        planId: 'unknown-plan',
      });

      const result = await subscriptionService.checkFeatureAccess(
        'user-1',
        'apiAccess',
      );
      expect(result).toBe(false);
    });
  });
});
