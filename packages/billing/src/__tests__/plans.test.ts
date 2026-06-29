import { describe, it, expect } from 'vitest';

import { PlanService } from '../plans';
import { PlanTier } from '../types';

describe('PlanService', () => {
  const planService = new PlanService();

  describe('getPlan', () => {
    it('should return FREE plan definition', () => {
      const plan = planService.getPlan(PlanTier.FREE);
      expect(plan.name).toBe('Free');
      expect(plan.slug).toBe('free');
      expect(plan.tier).toBe(PlanTier.FREE);
      expect(plan.monthlyPrice).toBe(0);
      expect(plan.yearlyPrice).toBe(0);
    });

    it('should return PRO plan definition', () => {
      const plan = planService.getPlan(PlanTier.PRO);
      expect(plan.name).toBe('Pro');
      expect(plan.slug).toBe('pro');
      expect(plan.tier).toBe(PlanTier.PRO);
      expect(plan.monthlyPrice).toBe(2900);
      expect(plan.yearlyPrice).toBe(29000);
    });

    it('should return TEAM plan definition', () => {
      const plan = planService.getPlan(PlanTier.TEAM);
      expect(plan.name).toBe('Team');
      expect(plan.tier).toBe(PlanTier.TEAM);
      expect(plan.monthlyPrice).toBe(7900);
    });

    it('should return ENTERPRISE plan definition', () => {
      const plan = planService.getPlan(PlanTier.ENTERPRISE);
      expect(plan.name).toBe('Enterprise');
      expect(plan.tier).toBe(PlanTier.ENTERPRISE);
      expect(plan.monthlyPrice).toBe(29900);
    });

    it('should throw for invalid tier', () => {
      expect(() => planService.getPlan('INVALID' as PlanTier)).toThrow(
        'Plan not found for tier: INVALID',
      );
    });
  });

  describe('getPlanBySlug', () => {
    it('should find plan by slug', () => {
      const plan = planService.getPlanBySlug('pro');
      expect(plan).toBeDefined();
      expect(plan!.tier).toBe(PlanTier.PRO);
    });

    it('should return undefined for unknown slug', () => {
      const plan = planService.getPlanBySlug('nonexistent');
      expect(plan).toBeUndefined();
    });
  });

  describe('listPlans', () => {
    it('should return all plan definitions', () => {
      const plans = planService.listPlans();
      expect(plans).toHaveLength(4);
      expect(plans.map((p) => p.tier)).toContain(PlanTier.FREE);
      expect(plans.map((p) => p.tier)).toContain(PlanTier.PRO);
      expect(plans.map((p) => p.tier)).toContain(PlanTier.TEAM);
      expect(plans.map((p) => p.tier)).toContain(PlanTier.ENTERPRISE);
    });
  });

  describe('getPlanLimits', () => {
    it('should return FREE tier limits', () => {
      const limits = planService.getPlanLimits(PlanTier.FREE);
      expect(limits.maxProjects).toBe(3);
      expect(limits.maxAiTokensPerMonth).toBe(10000);
      expect(limits.maxTeamMembers).toBe(1);
      expect(limits.maxDeploymentsPerMonth).toBe(5);
      expect(limits.maxStorageMb).toBe(500);
      expect(limits.maxApiCallsPerMonth).toBe(1000);
    });

    it('should return ENTERPRISE tier with unlimited (-1) limits', () => {
      const limits = planService.getPlanLimits(PlanTier.ENTERPRISE);
      expect(limits.maxProjects).toBe(-1);
      expect(limits.maxAiTokensPerMonth).toBe(-1);
      expect(limits.maxTeamMembers).toBe(-1);
      expect(limits.maxDeploymentsPerMonth).toBe(-1);
      expect(limits.maxStorageMb).toBe(-1);
      expect(limits.maxApiCallsPerMonth).toBe(-1);
    });
  });

  describe('getPlanFeatures', () => {
    it('should return FREE tier features', () => {
      const features = planService.getPlanFeatures(PlanTier.FREE);
      expect(features.apiAccess).toBe(true);
      expect(features.customDomains).toBe(false);
      expect(features.prioritySupport).toBe(false);
      expect(features.ssoIntegration).toBe(false);
    });

    it('should return ENTERPRISE tier with all features enabled', () => {
      const features = planService.getPlanFeatures(PlanTier.ENTERPRISE);
      expect(features.apiAccess).toBe(true);
      expect(features.customDomains).toBe(true);
      expect(features.prioritySupport).toBe(true);
      expect(features.ssoIntegration).toBe(true);
      expect(features.auditLogs).toBe(true);
      expect(features.customBranding).toBe(true);
    });
  });

  describe('hasFeature', () => {
    it('should return true for apiAccess on FREE tier', () => {
      expect(planService.hasFeature(PlanTier.FREE, 'apiAccess')).toBe(true);
    });

    it('should return false for customDomains on FREE tier', () => {
      expect(planService.hasFeature(PlanTier.FREE, 'customDomains')).toBe(false);
    });

    it('should return true for customDomains on PRO tier', () => {
      expect(planService.hasFeature(PlanTier.PRO, 'customDomains')).toBe(true);
    });
  });

  describe('getLimit', () => {
    it('should return specific limit value', () => {
      expect(planService.getLimit(PlanTier.FREE, 'maxProjects')).toBe(3);
      expect(planService.getLimit(PlanTier.PRO, 'maxProjects')).toBe(20);
      expect(planService.getLimit(PlanTier.TEAM, 'maxProjects')).toBe(100);
      expect(planService.getLimit(PlanTier.ENTERPRISE, 'maxProjects')).toBe(-1);
    });
  });
});
