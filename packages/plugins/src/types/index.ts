// @builder/plugins - Plugin System Types

// ============================================================================
// Enums
// ============================================================================

export enum PluginStatus {
  INSTALLED = 'INSTALLED',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
  UPDATING = 'UPDATING',
}

export enum PluginHook {
  ON_INSTALL = 'onInstall',
  ON_ACTIVATE = 'onActivate',
  ON_DEACTIVATE = 'onDeactivate',
  ON_UNINSTALL = 'onUninstall',
  ON_PROJECT_CREATE = 'onProjectCreate',
  ON_BUILD = 'onBuild',
  ON_DEPLOY = 'onDeploy',
  ON_CODE_GEN = 'onCodeGen',
}

export enum PluginPermission {
  READ_FILES = 'READ_FILES',
  WRITE_FILES = 'WRITE_FILES',
  NETWORK = 'NETWORK',
  AI_ACCESS = 'AI_ACCESS',
  DEPLOY = 'DEPLOY',
  GIT = 'GIT',
}

export enum PluginCategory {
  TOOLING = 'TOOLING',
  INTEGRATION = 'INTEGRATION',
  THEME = 'THEME',
  LANGUAGE = 'LANGUAGE',
  DEPLOYMENT = 'DEPLOYMENT',
  SECURITY = 'SECURITY',
  AI = 'AI',
  OTHER = 'OTHER',
}

// ============================================================================
// Interfaces
// ============================================================================

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  keywords: string[];
  category: PluginCategory;
  permissions: PluginPermission[];
  entry: string;
  hooks: PluginHook[];
  dependencies: Record<string, string>;
  engines: {
    builder: string;
    node?: string;
  };
}

export interface PluginContext {
  pluginId: string;
  workspaceRoot: string;
  pluginDataDir: string;
  config: Record<string, unknown>;
  logger: PluginLogger;
}

export interface PluginLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

export interface PluginExecutionResult {
  success: boolean;
  hook: PluginHook;
  pluginId: string;
  duration: number;
  error?: string;
  data?: unknown;
}

export interface PluginConfig {
  id: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  permissions: PluginPermission[];
}

export interface MarketplaceListing {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  keywords: string[];
  category: PluginCategory;
  downloads: number;
  rating: number;
  reviewCount: number;
  publishedAt: Date;
  updatedAt: Date;
  verified: boolean;
}

export interface PluginReview {
  id: string;
  pluginId: string;
  userId: string;
  rating: number;
  title: string;
  body: string;
  createdAt: Date;
}

export interface PluginVersion {
  version: string;
  changelog: string;
  publishedAt: Date;
  minBuilderVersion: string;
  downloads: number;
}

export interface MarketplaceSearchFilters {
  category?: PluginCategory;
  minRating?: number;
  verified?: boolean;
  sortBy?: 'downloads' | 'rating' | 'recent';
  page?: number;
  pageSize?: number;
}

export interface MarketplaceSearchResult {
  items: MarketplaceListing[];
  total: number;
  page: number;
  pageSize: number;
}
