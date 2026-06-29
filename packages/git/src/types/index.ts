// @builder/git - Git Integration Types

// ============================================================================
// Enums
// ============================================================================

export enum GitProvider {
  GITHUB = 'GITHUB',
  GITLAB = 'GITLAB',
  BITBUCKET = 'BITBUCKET',
}

export enum PullRequestStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  MERGED = 'MERGED',
}

export enum ConflictType {
  CONTENT = 'CONTENT',
  ADD_ADD = 'ADD_ADD',
  MODIFY_DELETE = 'MODIFY_DELETE',
  RENAME = 'RENAME',
}

export enum BranchStrategyType {
  GITFLOW = 'GITFLOW',
  GITHUB_FLOW = 'GITHUB_FLOW',
  TRUNK_BASED = 'TRUNK_BASED',
}

// ============================================================================
// Interfaces
// ============================================================================

export interface RepositoryConfig {
  provider: GitProvider;
  owner: string;
  name: string;
  defaultBranch: string;
  isPrivate: boolean;
  description?: string;
}

export interface BranchInfo {
  name: string;
  sha: string;
  isDefault: boolean;
  isProtected: boolean;
  behindAhead?: {
    behind: number;
    ahead: number;
  };
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: Date;
  files: string[];
}

export interface PullRequestInfo {
  id: string;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  status: PullRequestStatus;
  author: string;
  reviewers: string[];
  createdAt: Date;
}

export interface MergeResult {
  success: boolean;
  sha?: string;
  conflicts?: ConflictInfo[];
  message: string;
}

export interface ConflictInfo {
  file: string;
  type: ConflictType;
  ours?: string;
  theirs?: string;
}

export interface ReleaseInfo {
  tag: string;
  title: string;
  body: string;
  isDraft: boolean;
  isPrerelease: boolean;
}

export interface FileChange {
  path: string;
  content: string;
  operation: 'add' | 'modify' | 'delete';
}

export interface HistoryOptions {
  branch?: string;
  limit?: number;
  offset?: number;
  since?: Date;
  until?: Date;
  path?: string;
}

export interface CreatePullRequestInput {
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  reviewers?: string[];
}
