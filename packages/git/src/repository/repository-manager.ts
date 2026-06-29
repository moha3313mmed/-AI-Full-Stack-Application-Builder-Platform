// @builder/git - Repository Manager

import { BaseGitProvider } from '../providers/base-git-provider.js';
import { GitHubProvider } from '../providers/github-provider.js';
import { GitLabProvider } from '../providers/gitlab-provider.js';
import {
  RepositoryConfig,
  BranchInfo,
  CommitInfo,
  FileChange,
  GitProvider,
  HistoryOptions,
} from '../types/index.js';

export interface RepositoryManagerOptions {
  /** GitHub personal access token for API operations */
  githubToken?: string;
  /** GitLab personal access token for API operations */
  gitlabToken?: string;
}

export interface RepositoryState {
  config: RepositoryConfig | null;
  currentBranch: string | null;
  isConnected: boolean;
  localPath: string | null;
}

/**
 * RepositoryManager manages the lifecycle of a project repository.
 * It handles initialization, connecting to remotes, syncing changes,
 * and integrating with VFS-style file operations for committing generated files.
 */
export class RepositoryManager {
  private provider: BaseGitProvider | null = null;
  private options: RepositoryManagerOptions;
  private state: RepositoryState = {
    config: null,
    currentBranch: null,
    isConnected: false,
    localPath: null,
  };
  private stagedFiles: FileChange[] = [];

  constructor(options: RepositoryManagerOptions = {}) {
    this.options = options;
  }

  /**
   * Initialize a new repository with the given configuration.
   * Creates the remote repository and sets up the default branch.
   */
  async init(config: RepositoryConfig): Promise<{ url: string; cloneUrl: string }> {
    this.state.config = config;
    this.provider = this.createProvider(config.provider);
    const result = await this.provider.createRepository(config);

    this.state = {
      config,
      currentBranch: config.defaultBranch,
      isConnected: true,
      localPath: null,
    };

    return result;
  }

  /**
   * Connect to an existing remote repository by cloning it.
   */
  async connect(url: string, path: string, providerType: GitProvider): Promise<void> {
    this.provider = this.createProvider(providerType);
    await this.provider.cloneRepository(url, path);

    this.state = {
      config: null,
      currentBranch: 'main',
      isConnected: true,
      localPath: path,
    };
  }

  /**
   * Stage files for the next commit (VFS integration).
   * Accepts file changes from codegen or editor operations.
   */
  stageFiles(files: FileChange[]): void {
    this.stagedFiles.push(...files);
  }

  /**
   * Get the currently staged files.
   */
  getStagedFiles(): FileChange[] {
    return [...this.stagedFiles];
  }

  /**
   * Clear all staged files.
   */
  clearStaged(): void {
    this.stagedFiles = [];
  }

  /**
   * Commit staged files with a message.
   */
  async commit(message: string, branch?: string): Promise<CommitInfo> {
    this.ensureConnected();

    if (this.stagedFiles.length === 0) {
      throw new Error('No files staged for commit');
    }

    const targetBranch = branch || this.state.currentBranch!;
    const commit = await this.provider!.commit(this.stagedFiles, message, targetBranch);
    this.stagedFiles = [];

    return commit;
  }

  /**
   * Commit specific files with a message (bypasses staging).
   */
  async commitFiles(files: FileChange[], message: string, branch?: string): Promise<CommitInfo> {
    this.ensureConnected();

    const targetBranch = branch || this.state.currentBranch!;
    return this.provider!.commit(files, message, targetBranch);
  }

  /**
   * Push commits to the remote.
   */
  async push(branch?: string): Promise<void> {
    this.ensureConnected();
    const targetBranch = branch || this.state.currentBranch!;
    await this.provider!.push(targetBranch);
  }

  /**
   * Pull latest changes from the remote.
   */
  async pull(branch?: string): Promise<CommitInfo[]> {
    this.ensureConnected();
    const targetBranch = branch || this.state.currentBranch!;
    return this.provider!.pull(targetBranch);
  }

  /**
   * Sync: pull then push.
   */
  async sync(branch?: string): Promise<{ pulled: CommitInfo[]; pushed: boolean }> {
    this.ensureConnected();
    const targetBranch = branch || this.state.currentBranch!;
    const pulled = await this.provider!.pull(targetBranch);
    await this.provider!.push(targetBranch);
    return { pulled, pushed: true };
  }

  /**
   * Create a new branch and optionally switch to it.
   */
  async createBranch(name: string, from?: string, switchTo = true): Promise<BranchInfo> {
    this.ensureConnected();
    const branch = await this.provider!.createBranch(name, from);

    if (switchTo) {
      this.state.currentBranch = name;
    }

    return branch;
  }

  /**
   * Switch to an existing branch.
   */
  async switchBranch(name: string): Promise<void> {
    this.ensureConnected();
    const branches = await this.provider!.listBranches();
    const exists = branches.find((b) => b.name === name);

    if (!exists) {
      throw new Error(`Branch "${name}" does not exist`);
    }

    this.state.currentBranch = name;
  }

  /**
   * List all branches.
   */
  async listBranches(): Promise<BranchInfo[]> {
    this.ensureConnected();
    return this.provider!.listBranches();
  }

  /**
   * Get commit history.
   */
  async getHistory(options?: HistoryOptions): Promise<CommitInfo[]> {
    this.ensureConnected();
    return this.provider!.getHistory(options);
  }

  /**
   * Get the current repository state.
   */
  getState(): RepositoryState {
    return { ...this.state };
  }

  /**
   * Get the current branch name.
   */
  getCurrentBranch(): string | null {
    return this.state.currentBranch;
  }

  /**
   * Check if the repository is connected.
   */
  isConnected(): boolean {
    return this.state.isConnected;
  }

  /**
   * Get the underlying provider instance.
   */
  getProvider(): BaseGitProvider | null {
    return this.provider;
  }

  private createProvider(providerType: GitProvider): BaseGitProvider {
    switch (providerType) {
      case GitProvider.GITHUB:
        return new GitHubProvider({
          token: this.options.githubToken,
          owner: this.state.config?.owner,
          repo: this.state.config?.name,
        });
      case GitProvider.GITLAB:
        return new GitLabProvider({
          token: this.options.gitlabToken,
        });
      default:
        throw new Error(`Unsupported Git provider: ${providerType}`);
    }
  }

  private ensureConnected(): void {
    if (!this.state.isConnected || !this.provider) {
      throw new Error('Repository is not connected. Call init() or connect() first.');
    }
  }
}
