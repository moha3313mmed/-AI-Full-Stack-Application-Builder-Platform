import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  RepositoryManager,
  GitProvider,
  RepositoryConfig,
  FileChange,
} from '../index.js';

// Mock @octokit/rest for GitHubProvider
vi.mock('@octokit/rest', () => {
  // In-memory state for simulated GitHub API
  let branches: Map<string, { sha: string; protected: boolean }>;
  let commits: Array<{ sha: string; message: string; files: string[] }>;
  let nextSha: number;

  function generateSha(): string {
    nextSha++;
    const base = nextSha.toString(16).padStart(40, '0');
    return base.slice(0, 40);
  }

  // Reset state for each Octokit instance
  function resetState() {
    branches = new Map();
    commits = [];
    nextSha = 0;
  }

  const MockOctokit = vi.fn().mockImplementation(() => {
    resetState();

    return {
      users: {
        getAuthenticated: vi.fn().mockResolvedValue({
          data: { login: 'test-user' },
        }),
      },
      repos: {
        createForAuthenticatedUser: vi.fn().mockImplementation(({ name }: { name: string }) => {
          const sha = generateSha();
          branches.set('main', { sha, protected: false });
          return Promise.resolve({
            data: {
              html_url: `https://github.com/test-user/${name}`,
              clone_url: `https://github.com/test-user/${name}.git`,
            },
          });
        }),
        createInOrg: vi.fn().mockImplementation(({ org, name }: { org: string; name: string }) => {
          const sha = generateSha();
          branches.set('main', { sha, protected: false });
          return Promise.resolve({
            data: {
              html_url: `https://github.com/${org}/${name}`,
              clone_url: `https://github.com/${org}/${name}.git`,
            },
          });
        }),
        get: vi.fn().mockResolvedValue({
          data: { default_branch: 'main' },
        }),
        listBranches: vi.fn().mockImplementation(() => {
          const result = Array.from(branches.entries()).map(([branchName, info]) => ({
            name: branchName,
            commit: { sha: info.sha },
            protected: info.protected,
          }));
          return Promise.resolve({ data: result });
        }),
        merge: vi.fn().mockImplementation(({ base, head }: { base: string; head: string }) => {
          const sourceBranch = branches.get(head);
          if (!sourceBranch) {
            return Promise.reject({ status: 404, message: 'Not found' });
          }
          const sha = generateSha();
          const targetBranch = branches.get(base);
          if (targetBranch) {
            branches.set(base, { ...targetBranch, sha });
          }
          return Promise.resolve({
            data: { sha, message: `Merged ${head} into ${base}` },
          });
        }),
        listCommits: vi.fn().mockImplementation(() => {
          return Promise.resolve({
            data: commits.map((c) => ({
              sha: c.sha,
              commit: {
                message: c.message,
                author: { name: 'test-user', date: new Date().toISOString() },
              },
              author: { login: 'test-user' },
            })),
          });
        }),
        createRelease: vi.fn().mockResolvedValue({ data: {} }),
        compareCommits: vi.fn().mockResolvedValue({ data: { status: 'ahead' } }),
      },
      git: {
        getRef: vi.fn().mockImplementation(({ ref }: { ref: string }) => {
          const branchName = ref.replace('heads/', '');
          const branch = branches.get(branchName);
          if (!branch) {
            return Promise.reject(new Error(`Branch "${branchName}" does not exist`));
          }
          return Promise.resolve({
            data: { object: { sha: branch.sha } },
          });
        }),
        createRef: vi.fn().mockImplementation(({ ref, sha }: { ref: string; sha: string }) => {
          const branchName = ref.replace('refs/heads/', '');
          if (branches.has(branchName)) {
            return Promise.reject(new Error(`Branch "${branchName}" already exists`));
          }
          branches.set(branchName, { sha, protected: false });
          return Promise.resolve({ data: { ref, object: { sha } } });
        }),
        getCommit: vi.fn().mockImplementation(({ commit_sha }: { commit_sha: string }) => {
          return Promise.resolve({
            data: {
              sha: commit_sha,
              tree: { sha: generateSha() },
            },
          });
        }),
        createBlob: vi.fn().mockImplementation(() => {
          return Promise.resolve({ data: { sha: generateSha() } });
        }),
        createTree: vi.fn().mockImplementation(() => {
          return Promise.resolve({ data: { sha: generateSha() } });
        }),
        createCommit: vi.fn().mockImplementation(({ message }: { message: string }) => {
          const sha = generateSha();
          commits.push({ sha, message, files: [] });
          return Promise.resolve({
            data: {
              sha,
              message,
              author: { name: 'test-user', date: new Date().toISOString() },
            },
          });
        }),
        updateRef: vi.fn().mockImplementation(({ ref, sha }: { ref: string; sha: string }) => {
          const branchName = ref.replace('heads/', '');
          const branch = branches.get(branchName);
          if (branch) {
            branches.set(branchName, { ...branch, sha });
          }
          return Promise.resolve({ data: {} });
        }),
      },
      pulls: {
        create: vi.fn().mockImplementation(({ title, body, head, base }: { title: string; body: string; head: string; base: string }) => {
          return Promise.resolve({
            data: {
              number: 1,
              title,
              body,
              head: { ref: head },
              base: { ref: base },
              user: { login: 'test-user' },
              created_at: new Date().toISOString(),
              requested_reviewers: [],
            },
          });
        }),
        list: vi.fn().mockResolvedValue({ data: [] }),
        requestReviewers: vi.fn().mockResolvedValue({ data: {} }),
      },
    };
  });

  return { Octokit: MockOctokit };
});

describe('RepositoryManager', () => {
  let manager: RepositoryManager;

  const repoConfig: RepositoryConfig = {
    provider: GitProvider.GITHUB,
    owner: 'test-org',
    name: 'test-repo',
    defaultBranch: 'main',
    isPrivate: false,
    description: 'A test repository',
  };

  beforeEach(() => {
    manager = new RepositoryManager({ githubToken: 'test-token' });
  });

  describe('init', () => {
    it('should initialize a new repository', async () => {
      const result = await manager.init(repoConfig);

      expect(result.url).toBe('https://github.com/test-org/test-repo');
      expect(result.cloneUrl).toBe('https://github.com/test-org/test-repo.git');
    });

    it('should set connected state after init', async () => {
      await manager.init(repoConfig);

      expect(manager.isConnected()).toBe(true);
      expect(manager.getCurrentBranch()).toBe('main');
    });

    it('should initialize with GitLab provider', async () => {
      const gitlabConfig: RepositoryConfig = {
        ...repoConfig,
        provider: GitProvider.GITLAB,
      };

      const result = await manager.init(gitlabConfig);

      expect(result.url).toContain('gitlab.com');
      expect(manager.isConnected()).toBe(true);
    });

    it('should throw for unsupported provider', async () => {
      const badConfig: RepositoryConfig = {
        ...repoConfig,
        provider: GitProvider.BITBUCKET,
      };

      await expect(manager.init(badConfig)).rejects.toThrow('Unsupported Git provider');
    });
  });

  describe('connect', () => {
    it('should connect to an existing repository', async () => {
      await manager.connect(
        'https://github.com/test-org/test-repo.git',
        '/tmp/repo',
        GitProvider.GITHUB,
      );

      expect(manager.isConnected()).toBe(true);
    });
  });

  describe('staging and committing', () => {
    beforeEach(async () => {
      await manager.init(repoConfig);
    });

    it('should stage files for commit', () => {
      const files: FileChange[] = [
        { path: 'src/index.ts', content: 'console.log("hello")', operation: 'add' },
      ];

      manager.stageFiles(files);

      expect(manager.getStagedFiles()).toHaveLength(1);
      expect(manager.getStagedFiles()[0].path).toBe('src/index.ts');
    });

    it('should clear staged files', () => {
      manager.stageFiles([
        { path: 'src/index.ts', content: 'test', operation: 'add' },
      ]);

      manager.clearStaged();

      expect(manager.getStagedFiles()).toHaveLength(0);
    });

    it('should commit staged files', async () => {
      const files: FileChange[] = [
        { path: 'src/app.ts', content: 'export class App {}', operation: 'add' },
        { path: 'src/main.ts', content: 'new App()', operation: 'add' },
      ];

      manager.stageFiles(files);
      const commit = await manager.commit('feat: initial commit');

      expect(commit.sha).toHaveLength(40);
      expect(commit.message).toBe('feat: initial commit');
      expect(commit.files).toHaveLength(2);
      expect(manager.getStagedFiles()).toHaveLength(0);
    });

    it('should throw when committing with no staged files', async () => {
      await expect(manager.commit('empty commit')).rejects.toThrow('No files staged');
    });

    it('should commit files directly without staging', async () => {
      const files: FileChange[] = [
        { path: 'README.md', content: '# Hello', operation: 'add' },
      ];

      const commit = await manager.commitFiles(files, 'docs: add readme');

      expect(commit.message).toBe('docs: add readme');
      expect(commit.files).toContain('README.md');
    });
  });

  describe('branch operations', () => {
    beforeEach(async () => {
      await manager.init(repoConfig);
    });

    it('should create a new branch', async () => {
      const branch = await manager.createBranch('feature/test');

      expect(branch.name).toBe('feature/test');
      expect(branch.isDefault).toBe(false);
      expect(manager.getCurrentBranch()).toBe('feature/test');
    });

    it('should create a branch without switching', async () => {
      await manager.createBranch('feature/other', undefined, false);

      expect(manager.getCurrentBranch()).toBe('main');
    });

    it('should list branches', async () => {
      await manager.createBranch('feature/a', undefined, false);
      await manager.createBranch('feature/b', undefined, false);

      const branches = await manager.listBranches();

      expect(branches.length).toBeGreaterThanOrEqual(3);
    });

    it('should switch to an existing branch', async () => {
      await manager.createBranch('feature/switch', undefined, false);

      await manager.switchBranch('feature/switch');

      expect(manager.getCurrentBranch()).toBe('feature/switch');
    });

    it('should throw when switching to non-existent branch', async () => {
      await expect(manager.switchBranch('non-existent')).rejects.toThrow('does not exist');
    });
  });

  describe('sync operations', () => {
    beforeEach(async () => {
      await manager.init(repoConfig);
    });

    it('should push to remote', async () => {
      await expect(manager.push()).resolves.not.toThrow();
    });

    it('should pull from remote', async () => {
      const commits = await manager.pull();

      expect(Array.isArray(commits)).toBe(true);
    });

    it('should sync (pull then push)', async () => {
      const result = await manager.sync();

      expect(result.pushed).toBe(true);
      expect(Array.isArray(result.pulled)).toBe(true);
    });
  });

  describe('state management', () => {
    it('should report disconnected state initially', () => {
      expect(manager.isConnected()).toBe(false);
      expect(manager.getCurrentBranch()).toBeNull();
    });

    it('should return full state', async () => {
      await manager.init(repoConfig);

      const state = manager.getState();

      expect(state.isConnected).toBe(true);
      expect(state.currentBranch).toBe('main');
      expect(state.config).toEqual(repoConfig);
    });

    it('should throw operations when disconnected', async () => {
      await expect(manager.commit('test')).rejects.toThrow('not connected');
    });
  });

  describe('history', () => {
    beforeEach(async () => {
      await manager.init(repoConfig);
    });

    it('should get commit history', async () => {
      manager.stageFiles([{ path: 'file.ts', content: 'content', operation: 'add' }]);
      await manager.commit('first commit');

      const history = await manager.getHistory();

      expect(Array.isArray(history)).toBe(true);
    });
  });
});
