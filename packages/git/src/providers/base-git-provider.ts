// @builder/git - Base Git Provider (Abstract)

import {
  RepositoryConfig,
  BranchInfo,
  CommitInfo,
  PullRequestInfo,
  MergeResult,
  ConflictInfo,
  ReleaseInfo,
  FileChange,
  HistoryOptions,
  CreatePullRequestInput,
  GitProvider,
} from '../types/index.js';

/**
 * Abstract base class for Git provider implementations.
 * Provides common functionality and defines the interface that all
 * Git providers (GitHub, GitLab, Bitbucket) must implement.
 */
export abstract class BaseGitProvider {
  abstract readonly provider: GitProvider;

  /**
   * Create a new remote repository
   */
  abstract createRepository(config: RepositoryConfig): Promise<{ url: string; cloneUrl: string }>;

  /**
   * Clone a repository to a local path
   */
  abstract cloneRepository(url: string, path: string): Promise<void>;

  /**
   * Commit file changes to the repository
   */
  abstract commit(files: FileChange[], message: string, branch?: string): Promise<CommitInfo>;

  /**
   * Push commits to the remote branch
   */
  abstract push(branch: string): Promise<void>;

  /**
   * Pull latest changes from the remote branch
   */
  abstract pull(branch: string): Promise<CommitInfo[]>;

  /**
   * Create a new branch from a source branch
   */
  abstract createBranch(name: string, from?: string): Promise<BranchInfo>;

  /**
   * List all branches in the repository
   */
  abstract listBranches(): Promise<BranchInfo[]>;

  /**
   * Merge source branch into target branch
   */
  abstract mergeBranch(source: string, target: string): Promise<MergeResult>;

  /**
   * Create a pull/merge request
   */
  abstract createPullRequest(pr: CreatePullRequestInput): Promise<PullRequestInfo>;

  /**
   * List open pull/merge requests
   */
  abstract listPullRequests(): Promise<PullRequestInfo[]>;

  /**
   * Get merge conflicts between source and target branches
   */
  abstract getConflicts(source: string, target: string): Promise<ConflictInfo[]>;

  /**
   * Create a release/tag
   */
  abstract createRelease(release: ReleaseInfo): Promise<ReleaseInfo>;

  /**
   * Get commit history
   */
  abstract getHistory(options?: HistoryOptions): Promise<CommitInfo[]>;
}
