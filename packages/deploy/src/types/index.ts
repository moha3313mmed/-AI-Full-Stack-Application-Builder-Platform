// @builder/deploy - Deployment Types

// ============================================================================
// Enums
// ============================================================================

export enum DeploymentProvider {
  VERCEL = 'VERCEL',
  NETLIFY = 'NETLIFY',
  RAILWAY = 'RAILWAY',
  RENDER = 'RENDER',
  FLY_IO = 'FLY_IO',
  DIGITALOCEAN = 'DIGITALOCEAN',
  AWS = 'AWS',
  AZURE = 'AZURE',
  GCP = 'GCP',
  CLOUDFLARE = 'CLOUDFLARE',
}

export enum DeploymentStatus {
  PENDING = 'PENDING',
  BUILDING = 'BUILDING',
  DEPLOYING = 'DEPLOYING',
  DEPLOYED = 'DEPLOYED',
  FAILED = 'FAILED',
  ROLLED_BACK = 'ROLLED_BACK',
}

// ============================================================================
// Interfaces
// ============================================================================

export interface DeploymentFileEntry {
  path: string;
  content: string;
}

export interface DeploymentConfig {
  provider: DeploymentProvider;
  envVars: Record<string, string>;
  buildCommand: string;
  outputDir: string;
  region?: string;
  customDomain?: string;
  projectId: string;
  commitHash?: string;
  /** Optional files to deploy directly (for file-upload providers like Vercel). */
  files?: DeploymentFileEntry[];
}

export interface DeploymentResult {
  id: string;
  url: string;
  status: DeploymentStatus;
  logs: string[];
  startedAt: Date;
  completedAt?: Date;
}

export interface ProviderCredentials {
  provider: DeploymentProvider;
  apiKey: string;
  teamId?: string;
  accountId?: string;
}

export interface RollbackRequest {
  deploymentId: string;
  targetVersion?: string;
  reason?: string;
}

export interface DeploymentLogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface DeploymentEvent {
  type: 'status_change' | 'log' | 'error';
  deploymentId: string;
  timestamp: Date;
  data: {
    previousStatus?: DeploymentStatus;
    currentStatus?: DeploymentStatus;
    message?: string;
    error?: string;
  };
}
