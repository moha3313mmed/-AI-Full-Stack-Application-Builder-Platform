// @builder/git - GitLab Provider Implementation

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
  PullRequestStatus,
} from '../types/index.js';

import { BaseGitProvider } from './base-git-provider.js';

export interface GitLabConfig {
  token?: string;
  baseUrl?: string;
  projectId?: string;
}

/**
 * GitLab provider adapter implementing the BaseGitProvider interface.
 * Uses the GitLab REST API interface pattern for repository management,
 * branch operations, merge request management, and releases.
 */
export class GitLabProvider extends BaseGitProvider {
  readonly provider = GitProvider.GITLAB;
  private config: GitLabConfig;
  private branches: Map<string, BranchInfo> = new Map();
  private commits: CommitInfo[] = [];
  private mergeRequests: PullRequestInfo[] = [];
  private releases: ReleaseInfo[] = [];
  private repositoryConfig: RepositoryConfig | null = null;

  constructor(config: GitLabConfig = {}) {
    super();
    this.config = {
      baseUrl: 'https://gitlab.com',
      ...config,
    };
  }

  async createRepository(config: RepositoryConfig): Promise<{ url: string; cloneUrl: string }> {
    this.repositoryConfig = config;

    const defaultBranch: BranchInfo = {
      name: config.defaultBranch,
      sha: this.generateSha(),
      isDefault: true,
      isProtected: true,
    };
    this.branches.set(config.defaultBranch, defaultBranch);

    const baseUrl = this.config.baseUrl || 'https://gitlab.com';
    const url = `${baseUrl}/${config.owner}/${config.name}`;
    const cloneUrl = `${baseUrl}/${config.owner}/${config.name}.git`;

    return { url, cloneUrl };
  }

  async cloneRepository(url: string, _path: string): Promise<void> {
    const match = url.match(/gitlab\.com[/:]([^/]+)\/([^/.]+)/);
    if (!match) {
      throw new Error(`Invalid GitLab repository URL: ${url}`);
    }

    const [, owner, name] = match;
    this.config.projectId = `${owner}/${name}`;
  }

  async commit(files: FileChange[], message: string, branch?: string): Promise<CommitInfo> {
    const targetBranch = branch || this.repositoryConfig?.defaultBranch || 'main';

    if (!this.branches.has(targetBranch)) {
      throw new Error(`Branch "${targetBranch}" does not exist`);
    }

    const commit: CommitInfo = {
      sha: this.generateSha(),
      message,
      author: 'gitlab-user',
      date: new Date(),
      files: files.map((f) => f.path),
    };

    this.commits.push(commit);

    // Update branch SHA
    const branchInfo = this.branches.get(targetBranch)!;
    this.branches.set(targetBranch, { ...branchInfo, sha: commit.sha });

    return commit;
  }

  async push(branch: string): Promise<void> {
    if (!this.branches.has(branch)) {
      throw new Error(`Branch "${branch}" does not exist`);
    }
  }

  async pull(branch: string): Promise<CommitInfo[]> {
    if (!this.branches.has(branch)) {
      throw new Error(`Branch "${branch}" does not exist`);
    }
    return this.commits.slice(-5);
  }

  async createBranch(name: string, from?: string): Promise<BranchInfo> {
    const sourceBranch = from || this.repositoryConfig?.defaultBranch || 'main';
    const source = this.branches.get(sourceBranch);

    if (!source) {
      throw new Error(`Source branch "${sourceBranch}" does not exist`);
    }

    if (this.branches.has(name)) {
      throw new Error(`Branch "${name}" already exists`);
    }

    const branch: BranchInfo = {
      name,
      sha: source.sha,
      isDefault: false,
      isProtected: false,
    };

    this.branches.set(name, branch);
    return branch;
  }

  async listBranches(): Promise<BranchInfo[]> {
    return Array.from(this.branches.values());
  }

  async mergeBranch(source: string, target: string): Promise<MergeResult> {
    const sourceBranch = this.branches.get(source);
    const targetBranch = this.branches.get(target);

    if (!sourceBranch) {
      throw new Error(`Source branch "${source}" does not exist`);
    }
    if (!targetBranch) {
      throw new Error(`Target branch "${target}" does not exist`);
    }

    const mergeSha = this.generateSha();
    this.branches.set(target, { ...targetBranch, sha: mergeSha });

    return {
      success: true,
      sha: mergeSha,
      message: `Merged ${source} into ${target}`,
    };
  }

  async createPullRequest(pr: CreatePullRequestInput): Promise<PullRequestInfo> {
    if (!this.branches.has(pr.sourceBranch)) {
      throw new Error(`Source branch "${pr.sourceBranch}" does not exist`);
    }
    if (!this.branches.has(pr.targetBranch)) {
      throw new Error(`Target branch "${pr.targetBranch}" does not exist`);
    }

    const mergeRequest: PullRequestInfo = {
      id: `mr-${this.mergeRequests.length + 1}`,
      title: pr.title,
      description: pr.description,
      sourceBranch: pr.sourceBranch,
      targetBranch: pr.targetBranch,
      status: PullRequestStatus.OPEN,
      author: 'gitlab-user',
      reviewers: pr.reviewers || [],
      createdAt: new Date(),
    };

    this.mergeRequests.push(mergeRequest);
    return mergeRequest;
  }

  async listPullRequests(): Promise<PullRequestInfo[]> {
    return this.mergeRequests.filter((mr) => mr.status === PullRequestStatus.OPEN);
  }

  async getConflicts(source: string, target: string): Promise<ConflictInfo[]> {
    if (!this.branches.has(source)) {
      throw new Error(`Source branch "${source}" does not exist`);
    }
    if (!this.branches.has(target)) {
      throw new Error(`Target branch "${target}" does not exist`);
    }

    return [];
  }

  async createRelease(release: ReleaseInfo): Promise<ReleaseInfo> {
    this.releases.push(release);
    return release;
  }

  async getHistory(options?: HistoryOptions): Promise<CommitInfo[]> {
    let history = [...this.commits];

    if (options?.since) {
      history = history.filter((c) => c.date >= options.since!);
    }
    if (options?.until) {
      history = history.filter((c) => c.date <= options.until!);
    }
    if (options?.path) {
      history = history.filter((c) => c.files.some((f) => f.startsWith(options.path!)));
    }

    const offset = options?.offset || 0;
    const limit = options?.limit || 50;

    return history.slice(offset, offset + limit).reverse();
  }

  private generateSha(): string {
    const chars = '0123456789abcdef';
    let sha = '';
    for (let i = 0; i < 40; i++) {
      sha += chars[Math.floor(Math.random() * chars.length)];
    }
    return sha;
  }
}
