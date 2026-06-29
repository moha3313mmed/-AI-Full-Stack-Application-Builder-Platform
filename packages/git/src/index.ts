// @builder/git - Git Integration for AI Builder Platform
//
// This package provides a provider-agnostic Git integration layer with
// adapters for GitHub and GitLab. It includes repository management,
// conflict resolution, branch strategy support, and VFS-style file operations
// for committing generated code.

// ============================================================================
// Types
// ============================================================================

export {
  GitProvider,
  PullRequestStatus,
  ConflictType,
  BranchStrategyType,
  type RepositoryConfig,
  type BranchInfo,
  type CommitInfo,
  type PullRequestInfo,
  type MergeResult,
  type ConflictInfo,
  type ReleaseInfo,
  type FileChange,
  type HistoryOptions,
  type CreatePullRequestInput,
} from './types/index.js';

// ============================================================================
// Providers
// ============================================================================

export { BaseGitProvider } from './providers/base-git-provider.js';
export { GitHubProvider, type GitHubConfig } from './providers/github-provider.js';
export { GitLabProvider, type GitLabConfig } from './providers/gitlab-provider.js';

// ============================================================================
// Repository Management
// ============================================================================

export { RepositoryManager, type RepositoryState, type RepositoryManagerOptions } from './repository/repository-manager.js';
export {
  ConflictResolver,
  ResolutionStrategy,
  type ConflictResolution,
  type ResolutionResult,
} from './repository/conflict-resolver.js';
export { BranchStrategy, type BranchStrategyConfig } from './repository/branch-strategy.js';
