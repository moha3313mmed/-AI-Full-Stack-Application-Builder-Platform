export enum PlanTier {
  FREE = 'FREE',
  PRO = 'PRO',
  TEAM = 'TEAM',
  ENTERPRISE = 'ENTERPRISE',
}

export enum UsageMetric {
  API_CALLS = 'API_CALLS',
  AI_TOKENS = 'AI_TOKENS',
  DEPLOYMENTS = 'DEPLOYMENTS',
  STORAGE_MB = 'STORAGE_MB',
  PROJECTS = 'PROJECTS',
  TEAM_MEMBERS = 'TEAM_MEMBERS',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
  TRIALING = 'TRIALING',
  PAUSED = 'PAUSED',
}

export interface PlanLimits {
  maxProjects: number;
  maxAiTokensPerMonth: number;
  maxTeamMembers: number;
  maxDeploymentsPerMonth: number;
  maxStorageMb: number;
  maxApiCallsPerMonth: number;
}

export interface PlanFeatures {
  customDomains: boolean;
  prioritySupport: boolean;
  advancedAnalytics: boolean;
  ssoIntegration: boolean;
  auditLogs: boolean;
  customBranding: boolean;
  apiAccess: boolean;
  webhooks: boolean;
}

export interface PlanDefinition {
  name: string;
  slug: string;
  description: string;
  tier: PlanTier;
  monthlyPrice: number; // in cents
  yearlyPrice: number; // in cents
  features: PlanFeatures;
  limits: PlanLimits;
}

export interface QuotaCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
}

export interface UsageData {
  userId: string;
  organizationId?: string;
  metric: UsageMetric;
  value: number;
  period: string;
}

export interface SubscriptionData {
  id: string;
  userId: string;
  organizationId?: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAt?: Date;
  externalId?: string;
  provider: string;
  metadata: Record<string, unknown>;
}

export interface CreateSubscriptionInput {
  userId: string;
  organizationId?: string;
  planTier: PlanTier;
  provider: string;
  externalId?: string;
}

export interface BillingCustomer {
  id: string;
  email: string;
  name: string;
  externalId?: string;
}

export interface BillingAdapterConfig {
  apiKey?: string;
  webhookSecret?: string;
}
