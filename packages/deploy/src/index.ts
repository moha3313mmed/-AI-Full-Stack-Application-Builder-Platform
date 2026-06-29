// @builder/deploy - Deployment Pipeline and Provider Adapters
//
// This package provides a provider-agnostic deployment pipeline with
// adapters for Vercel, Netlify, and other cloud providers. It includes
// environment variable management, build configuration resolution, and
// a provider registry using the strategy pattern.

// ============================================================================
// Types
// ============================================================================

export {
  DeploymentProvider,
  DeploymentStatus,
  type DeploymentConfig,
  type DeploymentFileEntry,
  type DeploymentResult,
  type ProviderCredentials,
  type RollbackRequest,
  type DeploymentLogEntry,
  type DeploymentEvent,
} from './types/index.js';

// ============================================================================
// Providers
// ============================================================================

export { BaseDeployProvider } from './providers/base-provider.js';
export { VercelProvider, type VercelProviderConfig } from './providers/vercel-provider.js';
export { NetlifyProvider } from './providers/netlify-provider.js';
export { ProviderRegistry, type ProviderFactory } from './providers/provider-registry.js';

// ============================================================================
// Pipeline
// ============================================================================

export { DeploymentPipeline, type PipelineEventHandler } from './pipeline/deployment-pipeline.js';
export { EnvironmentManager } from './pipeline/environment-manager.js';
export { BuildConfigResolver, type BuildConfiguration } from './pipeline/build-config.js';
