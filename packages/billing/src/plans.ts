import { PlanDefinition, PlanFeatures, PlanLimits, PlanTier } from './types';

const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
  [PlanTier.FREE]: {
    name: 'Free',
    slug: 'free',
    description: 'For individuals getting started',
    tier: PlanTier.FREE,
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: {
      customDomains: false,
      prioritySupport: false,
      advancedAnalytics: false,
      ssoIntegration: false,
      auditLogs: false,
      customBranding: false,
      apiAccess: true,
      webhooks: false,
    },
    limits: {
      maxProjects: 3,
      maxAiTokensPerMonth: 10000,
      maxTeamMembers: 1,
      maxDeploymentsPerMonth: 5,
      maxStorageMb: 500,
      maxApiCallsPerMonth: 1000,
    },
  },
  [PlanTier.PRO]: {
    name: 'Pro',
    slug: 'pro',
    description: 'For professionals and small teams',
    tier: PlanTier.PRO,
    monthlyPrice: 2900, // $29/month
    yearlyPrice: 29000, // $290/year
    features: {
      customDomains: true,
      prioritySupport: false,
      advancedAnalytics: true,
      ssoIntegration: false,
      auditLogs: false,
      customBranding: false,
      apiAccess: true,
      webhooks: true,
    },
    limits: {
      maxProjects: 20,
      maxAiTokensPerMonth: 100000,
      maxTeamMembers: 5,
      maxDeploymentsPerMonth: 50,
      maxStorageMb: 5000,
      maxApiCallsPerMonth: 10000,
    },
  },
  [PlanTier.TEAM]: {
    name: 'Team',
    slug: 'team',
    description: 'For growing teams and organizations',
    tier: PlanTier.TEAM,
    monthlyPrice: 7900, // $79/month
    yearlyPrice: 79000, // $790/year
    features: {
      customDomains: true,
      prioritySupport: true,
      advancedAnalytics: true,
      ssoIntegration: true,
      auditLogs: true,
      customBranding: false,
      apiAccess: true,
      webhooks: true,
    },
    limits: {
      maxProjects: 100,
      maxAiTokensPerMonth: 500000,
      maxTeamMembers: 25,
      maxDeploymentsPerMonth: 200,
      maxStorageMb: 25000,
      maxApiCallsPerMonth: 50000,
    },
  },
  [PlanTier.ENTERPRISE]: {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'For large organizations with custom needs',
    tier: PlanTier.ENTERPRISE,
    monthlyPrice: 29900, // $299/month
    yearlyPrice: 299000, // $2990/year
    features: {
      customDomains: true,
      prioritySupport: true,
      advancedAnalytics: true,
      ssoIntegration: true,
      auditLogs: true,
      customBranding: true,
      apiAccess: true,
      webhooks: true,
    },
    limits: {
      maxProjects: -1, // unlimited
      maxAiTokensPerMonth: -1,
      maxTeamMembers: -1,
      maxDeploymentsPerMonth: -1,
      maxStorageMb: -1,
      maxApiCallsPerMonth: -1,
    },
  },
};

export class PlanService {
  getPlan(tier: PlanTier): PlanDefinition {
    const plan = PLAN_DEFINITIONS[tier];
    if (!plan) {
      throw new Error(`Plan not found for tier: ${tier}`);
    }
    return plan;
  }

  getPlanBySlug(slug: string): PlanDefinition | undefined {
    return Object.values(PLAN_DEFINITIONS).find((p) => p.slug === slug);
  }

  listPlans(): PlanDefinition[] {
    return Object.values(PLAN_DEFINITIONS);
  }

  getPlanLimits(tier: PlanTier): PlanLimits {
    return this.getPlan(tier).limits;
  }

  getPlanFeatures(tier: PlanTier): PlanFeatures {
    return this.getPlan(tier).features;
  }

  hasFeature(tier: PlanTier, feature: keyof PlanFeatures): boolean {
    return this.getPlanFeatures(tier)[feature];
  }

  getLimit(tier: PlanTier, limitKey: keyof PlanLimits): number {
    return this.getPlanLimits(tier)[limitKey];
  }
}
