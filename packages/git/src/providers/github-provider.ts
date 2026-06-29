// @builder/git - GitHub Provider Implementation (Real API via Octokit)

import { Octokit } from '@octokit/rest';

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

export interface GitHubConfig {
  token?: string;
  baseUrl?: string;
  owner?: string;
  repo?: string;
}

/**
 * GitHub provider adapter implementing the BaseGitProvider interface.
 * Uses the GitHub REST API (via @octokit/rest) for repository management,
 * branch operations, PR management, and releases.
 *
 * Commits are performed via the Git Data API (blobs/trees/commits/refs),
 * which allows pushing files without needing a local clone.
 */
export class GitHubProvider extends BaseGitProvider {
  readonly provider = GitProvider.GITHUB;
  private config: GitHubConfig;
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private defaultBranch: string = 'main';

  constructor(config: GitHubConfig = {}) {
    super();

    if (!config.token) {
      throw new Error(
        'GitHub token not configured. Set the GITHUB_TOKEN environment variable or provide a token in GitHubConfig.',
      );
    }

    this.config = {
      baseUrl: 'https://api.github.com',
      ...config,
    };

    this.octokit = new Octokit({
      auth: config.token,
      ...(config.baseUrl && config.baseUrl !== 'https://api.github.com'
        ? { baseUrl: config.baseUrl }
        : {}),
    });

    this.owner = config.owner || '';
    this.repo = config.repo || '';
  }

  async createRepository(config: RepositoryConfig): Promise<{ url: string; cloneUrl: string }> {
    this.owner = config.owner;
    this.repo = config.name;
    this.defaultBranch = config.defaultBranch;

    // Determine if we need to create under an org or the authenticated user
    const authenticatedUser = await this.getAuthenticatedUser();
    let response;

    if (config.owner === authenticatedUser) {
      // Create under authenticated user
      response = await this.octokit.repos.createForAuthenticatedUser({
        name: config.name,
        description: config.description,
        private: config.isPrivate,
        auto_init: true,
        default_branch: config.defaultBranch,
      });
    } else {
      // Create under an organization
      response = await this.octokit.repos.createInOrg({
        org: config.owner,
        name: config.name,
        description: config.description,
        private: config.isPrivate,
        auto_init: true,
        default_branch: config.defaultBranch,
      });
    }

    return {
      url: response.data.html_url,
      cloneUrl: response.data.clone_url,
    };
  }

  async cloneRepository(url: string, _path: string): Promise<void> {
    // Extract owner/repo from URL and configure the provider
    const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (!match) {
      throw new Error(`Invalid GitHub repository URL: ${url}`);
    }

    const [, owner, name] = match;
    this.owner = owner;
    this.repo = name;
    this.config.owner = owner;
    this.config.repo = name;

    // Fetch the default branch
    const repoInfo = await this.octokit.repos.get({
      owner: this.owner,
      repo: this.repo,
    });
    this.defaultBranch = repoInfo.data.default_branch;
  }

  /**
   * Commit files using GitHub's Git Data API.
   * This creates blobs, a tree, a commit, and updates the branch ref,
   * all without needing a local clone.
   */
  async commit(files: FileChange[], message: string, branch?: string): Promise<CommitInfo> {
    const targetBranch = branch || this.defaultBranch;
    this.ensureConfigured();

    // 1. Get the current commit SHA of the target branch
    const refData = await this.octokit.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${targetBranch}`,
    });
    const parentSha = refData.data.object.sha;

    // 2. Get the tree SHA of the parent commit
    const parentCommit = await this.octokit.git.getCommit({
      owner: this.owner,
      repo: this.repo,
      commit_sha: parentSha,
    });
    const baseTreeSha = parentCommit.data.tree.sha;

    // 3. Create blobs for each file and build tree entries
    const treeEntries: Array<{
      path: string;
      mode: '100644' | '100755' | '040000' | '160000' | '120000';
      type: 'blob' | 'tree' | 'commit';
      sha?: string;
    }> = [];

    for (const file of files) {
      if (file.operation === 'delete') {
        // For deletions, we omit the sha which effectively removes the file
        // We need to use a null sha - handled via tree creation with the file absent
        // Actually, GitHub API requires setting sha to null for deletions
        treeEntries.push({
          path: file.path,
          mode: '100644',
          type: 'blob',
          sha: undefined,
        });
      } else {
        // Create a blob for add/modify operations
        const blob = await this.octokit.git.createBlob({
          owner: this.owner,
          repo: this.repo,
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64',
        });

        treeEntries.push({
          path: file.path,
          mode: '100644',
          type: 'blob',
          sha: blob.data.sha,
        });
      }
    }

    // 4. Create a new tree
    // Filter out delete entries with undefined sha - handle differently
    const validEntries = treeEntries.filter((e) => e.sha !== undefined);
    const deleteEntries = treeEntries.filter((e) => e.sha === undefined);

    // For trees with deletions, we need to pass sha as null
    const allEntries = [
      ...validEntries,
      ...deleteEntries.map((e) => ({ ...e, sha: null as unknown as string })),
    ];

    const tree = await this.octokit.git.createTree({
      owner: this.owner,
      repo: this.repo,
      base_tree: baseTreeSha,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tree: allEntries as any,
    });

    // 5. Create the commit
    const commit = await this.octokit.git.createCommit({
      owner: this.owner,
      repo: this.repo,
      message,
      tree: tree.data.sha,
      parents: [parentSha],
    });

    // 6. Update the branch reference to point to the new commit
    await this.octokit.git.updateRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${targetBranch}`,
      sha: commit.data.sha,
    });

    return {
      sha: commit.data.sha,
      message: commit.data.message,
      author: commit.data.author.name || this.owner,
      date: new Date(commit.data.author.date || Date.now()),
      files: files.map((f) => f.path),
    };
  }

  /**
   * Push is a no-op since commit() already updates remote refs directly via the API.
   */
  async push(_branch: string): Promise<void> {
    // No-op: commit() already pushes to the remote by updating the ref
  }

  async pull(branch: string): Promise<CommitInfo[]> {
    this.ensureConfigured();

    const response = await this.octokit.repos.listCommits({
      owner: this.owner,
      repo: this.repo,
      sha: branch,
      per_page: 10,
    });

    return response.data.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.commit.author?.name || c.author?.login || 'unknown',
      date: new Date(c.commit.author?.date || Date.now()),
      files: [], // Commit list endpoint does not include file details
    }));
  }

  async createBranch(name: string, from?: string): Promise<BranchInfo> {
    this.ensureConfigured();

    const sourceBranch = from || this.defaultBranch;

    // Get the SHA of the source branch
    const refData = await this.octokit.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${sourceBranch}`,
    });
    const sha = refData.data.object.sha;

    // Create the new branch ref
    await this.octokit.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${name}`,
      sha,
    });

    return {
      name,
      sha,
      isDefault: false,
      isProtected: false,
    };
  }

  async listBranches(): Promise<BranchInfo[]> {
    this.ensureConfigured();

    const response = await this.octokit.repos.listBranches({
      owner: this.owner,
      repo: this.repo,
      per_page: 100,
    });

    return response.data.map((b) => ({
      name: b.name,
      sha: b.commit.sha,
      isDefault: b.name === this.defaultBranch,
      isProtected: b.protected,
    }));
  }

  async mergeBranch(source: string, target: string): Promise<MergeResult> {
    this.ensureConfigured();

    try {
      const response = await this.octokit.repos.merge({
        owner: this.owner,
        repo: this.repo,
        base: target,
        head: source,
        commit_message: `Merged ${source} into ${target}`,
      });

      return {
        success: true,
        sha: response.data.sha,
        message: `Merged ${source} into ${target}`,
      };
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      if (err.status === 409) {
        return {
          success: false,
          message: `Merge conflict between ${source} and ${target}`,
          conflicts: [],
        };
      }
      throw error;
    }
  }

  async createPullRequest(pr: CreatePullRequestInput): Promise<PullRequestInfo> {
    this.ensureConfigured();

    const response = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title: pr.title,
      body: pr.description,
      head: pr.sourceBranch,
      base: pr.targetBranch,
    });

    // Request reviewers if provided
    if (pr.reviewers && pr.reviewers.length > 0) {
      try {
        await this.octokit.pulls.requestReviewers({
          owner: this.owner,
          repo: this.repo,
          pull_number: response.data.number,
          reviewers: pr.reviewers,
        });
      } catch {
        // Reviewer assignment is best-effort; don't fail the PR creation
      }
    }

    return {
      id: String(response.data.number),
      title: response.data.title,
      description: response.data.body || '',
      sourceBranch: response.data.head.ref,
      targetBranch: response.data.base.ref,
      status: PullRequestStatus.OPEN,
      author: response.data.user?.login || this.owner,
      reviewers: pr.reviewers || [],
      createdAt: new Date(response.data.created_at),
    };
  }

  async listPullRequests(): Promise<PullRequestInfo[]> {
    this.ensureConfigured();

    const response = await this.octokit.pulls.list({
      owner: this.owner,
      repo: this.repo,
      state: 'open',
      per_page: 50,
    });

    return response.data.map((pr) => ({
      id: String(pr.number),
      title: pr.title,
      description: pr.body || '',
      sourceBranch: pr.head.ref,
      targetBranch: pr.base.ref,
      status: PullRequestStatus.OPEN,
      author: pr.user?.login || 'unknown',
      reviewers: pr.requested_reviewers?.map((r) => ('login' in r ? r.login : '')) || [],
      createdAt: new Date(pr.created_at),
    }));
  }

  async getConflicts(source: string, target: string): Promise<ConflictInfo[]> {
    this.ensureConfigured();

    // GitHub does not have a direct API for listing conflicts.
    // We use the compare endpoint to check if branches can be merged.
    try {
      const response = await this.octokit.repos.compareCommits({
        owner: this.owner,
        repo: this.repo,
        base: target,
        head: source,
      });

      // If status is 'diverged', there may be conflicts but we cannot
      // enumerate them without attempting a merge.
      if (response.data.status === 'diverged') {
        return []; // Cannot determine specific conflicts via API alone
      }

      return [];
    } catch {
      return [];
    }
  }

  async createRelease(release: ReleaseInfo): Promise<ReleaseInfo> {
    this.ensureConfigured();

    await this.octokit.repos.createRelease({
      owner: this.owner,
      repo: this.repo,
      tag_name: release.tag,
      name: release.title,
      body: release.body,
      draft: release.isDraft,
      prerelease: release.isPrerelease,
    });

    return release;
  }

  async getHistory(options?: HistoryOptions): Promise<CommitInfo[]> {
    this.ensureConfigured();

    const params: Parameters<typeof this.octokit.repos.listCommits>[0] = {
      owner: this.owner,
      repo: this.repo,
      per_page: options?.limit || 50,
    };

    if (options?.branch) {
      params.sha = options.branch;
    }
    if (options?.since) {
      params.since = options.since.toISOString();
    }
    if (options?.until) {
      params.until = options.until.toISOString();
    }
    if (options?.path) {
      params.path = options.path;
    }

    const response = await this.octokit.repos.listCommits(params);

    const commits = response.data.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.commit.author?.name || c.author?.login || 'unknown',
      date: new Date(c.commit.author?.date || Date.now()),
      files: [] as string[],
    }));

    // Apply offset if provided (GitHub API doesn't support offset natively)
    const offset = options?.offset || 0;
    return commits.slice(offset);
  }

  private async getAuthenticatedUser(): Promise<string> {
    const response = await this.octokit.users.getAuthenticated();
    return response.data.login;
  }

  private ensureConfigured(): void {
    if (!this.owner || !this.repo) {
      throw new Error(
        'GitHub provider is not configured. Call createRepository() or cloneRepository() first.',
      );
    }
  }
}
