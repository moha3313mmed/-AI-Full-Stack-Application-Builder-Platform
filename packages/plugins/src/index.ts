// @builder/plugins - Plugin & Extension System
//
// This package provides a modular plugin architecture with lifecycle management,
// manifest validation, sandboxed execution, permission enforcement, a plugin SDK
// for authors, and a marketplace client for discovery and publishing.

// ============================================================================
// Types
// ============================================================================

export {
  PluginStatus,
  PluginHook,
  PluginPermission,
  PluginCategory,
  type PluginManifest,
  type PluginContext,
  type PluginLogger,
  type PluginExecutionResult,
  type PluginConfig,
  type MarketplaceListing,
  type PluginReview,
  type PluginVersion,
  type MarketplaceSearchFilters,
  type MarketplaceSearchResult,
} from './types/index.js';

// ============================================================================
// Manifest
// ============================================================================

export { ManifestValidator } from './manifest/manifest-validator.js';
export { ManifestLoader } from './manifest/manifest-loader.js';

// ============================================================================
// Lifecycle
// ============================================================================

export {
  PluginLifecycleManager,
  type LifecycleEvent,
  type LifecycleEventHandler,
} from './lifecycle/plugin-lifecycle.js';
export { HookExecutor, type HookExecutorOptions } from './lifecycle/hook-executor.js';

// ============================================================================
// Sandbox
// ============================================================================

export {
  PluginSandbox,
  type SandboxOptions,
  type SandboxFileOperation,
  type SandboxNetworkOperation,
} from './sandbox/plugin-sandbox.js';
export { PermissionGuard, PermissionDeniedError } from './sandbox/permission-guard.js';

// ============================================================================
// Registry
// ============================================================================

export { PluginRegistry, type RegisteredPlugin } from './registry/plugin-registry.js';

// ============================================================================
// SDK
// ============================================================================

export { PluginSDK, type HookHandler } from './sdk/plugin-sdk.js';

// ============================================================================
// Marketplace
// ============================================================================

export {
  MarketplaceClient,
  type MarketplaceClientOptions,
} from './marketplace/marketplace-client.js';
export { VersionResolver } from './marketplace/version-resolver.js';
