import { BillingAdapterConfig, BillingCustomer } from './types';

export interface BillingAdapter {
  createCustomer(email: string, name: string): Promise<BillingCustomer>;
  createSubscription(
    customerId: string,
    priceId: string,
  ): Promise<{ subscriptionId: string; status: string }>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  getSubscription(
    subscriptionId: string,
  ): Promise<{ status: string; currentPeriodEnd: Date } | null>;
}

export class StripeBillingAdapter implements BillingAdapter {
  private readonly config: BillingAdapterConfig;

  constructor(config: BillingAdapterConfig) {
    this.config = config;
  }

  private ensureConfigured(): void {
    if (!this.config.apiKey) {
      throw new Error('Stripe billing adapter is not configured: missing API key');
    }
  }

  async createCustomer(email: string, _name: string): Promise<BillingCustomer> {
    this.ensureConfigured();
    // Stub: In production, this would call Stripe API
    return {
      id: `cus_stub_${Date.now()}`,
      email,
      name: _name,
      externalId: `cus_stub_${Date.now()}`,
    };
  }

  async createSubscription(
    _customerId: string,
    _priceId: string,
  ): Promise<{ subscriptionId: string; status: string }> {
    this.ensureConfigured();
    // Stub: In production, this would call Stripe API
    return {
      subscriptionId: `sub_stub_${Date.now()}`,
      status: 'active',
    };
  }

  async cancelSubscription(_subscriptionId: string): Promise<void> {
    this.ensureConfigured();
    // Stub: In production, this would call Stripe API
  }

  async getSubscription(
    _subscriptionId: string,
  ): Promise<{ status: string; currentPeriodEnd: Date } | null> {
    this.ensureConfigured();
    // Stub: In production, this would call Stripe API
    return null;
  }
}
