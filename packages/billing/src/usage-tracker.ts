import { PlanService } from './plans';
import {
  PlanLimits,
  PlanTier,
  QuotaCheckResult,
  UsageData,
  UsageMetric,
} from './types';

export interface UsageStore {
  recordUsage(data: UsageData): Promise<void>;
  getUsage(userId: string, metric: UsageMetric, period: string): Promise<number>;
}

const METRIC_TO_LIMIT_KEY: Record<UsageMetric, keyof PlanLimits> = {
  [UsageMetric.API_CALLS]: 'maxApiCallsPerMonth',
  [UsageMetric.AI_TOKENS]: 'maxAiTokensPerMonth',
  [UsageMetric.DEPLOYMENTS]: 'maxDeploymentsPerMonth',
  [UsageMetric.STORAGE_MB]: 'maxStorageMb',
  [UsageMetric.PROJECTS]: 'maxProjects',
  [UsageMetric.TEAM_MEMBERS]: 'maxTeamMembers',
};

export class UsageTracker {
  private readonly planService: PlanService;
  private readonly store: UsageStore;

  constructor(store: UsageStore, planService?: PlanService) {
    this.store = store;
    this.planService = planService ?? new PlanService();
  }

  async recordUsage(data: UsageData): Promise<void> {
    await this.store.recordUsage(data);
  }

  async getUsage(
    userId: string,
    metric: UsageMetric,
    period: string,
  ): Promise<number> {
    return this.store.getUsage(userId, metric, period);
  }

  async checkQuota(
    userId: string,
    metric: UsageMetric,
    period: string,
    planTier: PlanTier,
  ): Promise<QuotaCheckResult> {
    const current = await this.getUsage(userId, metric, period);
    const limitKey = METRIC_TO_LIMIT_KEY[metric];
    const limit = this.planService.getLimit(planTier, limitKey);

    // -1 means unlimited
    if (limit === -1) {
      return {
        allowed: true,
        current,
        limit: -1,
        remaining: -1,
      };
    }

    const remaining = Math.max(0, limit - current);
    return {
      allowed: current < limit,
      current,
      limit,
      remaining,
    };
  }

  getCurrentPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}
