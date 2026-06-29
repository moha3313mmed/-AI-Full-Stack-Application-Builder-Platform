import { BillingAdapter } from './billing-adapter';
import { PlanService } from './plans';
import {
  CreateSubscriptionInput,
  PlanFeatures,
  PlanTier,
  SubscriptionData,
  SubscriptionStatus,
} from './types';

export interface SubscriptionStore {
  createSubscription(data: Omit<SubscriptionData, 'id'>): Promise<SubscriptionData>;
  getActiveSubscription(userId: string): Promise<SubscriptionData | null>;
  cancelSubscription(subscriptionId: string, cancelAt: Date): Promise<SubscriptionData>;
}

export class SubscriptionService {
  private readonly planService: PlanService;
  private readonly store: SubscriptionStore;
  private readonly billingAdapter?: BillingAdapter;

  constructor(
    store: SubscriptionStore,
    planService?: PlanService,
    billingAdapter?: BillingAdapter,
  ) {
    this.store = store;
    this.planService = planService ?? new PlanService();
    this.billingAdapter = billingAdapter;
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionData> {
    const plan = this.planService.getPlan(input.planTier);

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subscriptionData: Omit<SubscriptionData, 'id'> = {
      userId: input.userId,
      organizationId: input.organizationId,
      planId: plan.slug,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      externalId: input.externalId,
      provider: input.provider,
      metadata: {},
    };

    return this.store.createSubscription(subscriptionData);
  }

  async cancelSubscription(subscriptionId: string): Promise<SubscriptionData> {
    const cancelAt = new Date();
    cancelAt.setMonth(cancelAt.getMonth() + 1); // Cancel at end of current period

    if (this.billingAdapter) {
      await this.billingAdapter.cancelSubscription(subscriptionId);
    }

    return this.store.cancelSubscription(subscriptionId, cancelAt);
  }

  async getActiveSubscription(userId: string): Promise<SubscriptionData | null> {
    return this.store.getActiveSubscription(userId);
  }

  async checkFeatureAccess(
    userId: string,
    feature: keyof PlanFeatures,
  ): Promise<boolean> {
    const subscription = await this.getActiveSubscription(userId);

    if (!subscription) {
      // Default to FREE tier access
      return this.planService.hasFeature(PlanTier.FREE, feature);
    }

    const plan = this.planService.getPlanBySlug(subscription.planId);
    if (!plan) {
      return false;
    }

    return this.planService.hasFeature(plan.tier, feature);
  }
}
