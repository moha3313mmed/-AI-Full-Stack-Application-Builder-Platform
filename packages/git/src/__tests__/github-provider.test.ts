import { describe, it, expect, beforeEach, vi } from 'vitest';

import { GitHubProvider, GitHubConfig } from '../providers/github-provider.js';
import { GitProvider, PullRequestStatus } from '../types/index.js';

// Mock @octokit/rest
const mockOctokit = {
  users: {
    getAuthenticated: vi.fn(),
  },
  repos: {
    createForAuthenticatedUser: vi.fn(),
    createInOrg: vi.fn(),
    get: vi.fn(),
    listBranches: vi.fn(),
    merge: vi.fn(),
    listCommits: vi.fn(),
    createRelease: vi.fn(),
    compareCommits: vi.fn(),
  },
  git: {
    getRef: vi.fn(),
    createRef: vi.fn(),
    getCommit: vi.fn(),
    createBlob: vi.fn(),
    createTree: vi.fn(),
    createCommit: vi.fn(),
    updateRef: vi.fn(),
  },
  pulls: {
    create: vi.fn(),
    list: vi.fn(),
    requestReviewers: vi.fn(),
  },
};

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => mockOctokit),
}));

describe('GitHubProvider', () => {
  let provider: GitHubProvider;
  const defaultConfig: GitHubConfig = {
    token: 'test-token-123',
    owner: 'test-org',
    repo: 'test-repo',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GitHubProvider(defaultConfig);
  });

  describe('constructor', () => {
    it('should throw when no token is provided', () => {
      expect(() => new GitHubProvider({})).toThrow('GitHub token not configured');
      expect(() => new GitHubProvider()).toThrow('GitHub token not configured');
    });

    it('should create provider with valid token', () => {
      const p = new GitHubProvider({ token: 'my-token' });
      expect(p.provider).toBe(GitProvider.GITHUB);
    });

    it('should throw a helpful error message about GITHUB_TOKEN', () => {
      try {
        new GitHubProvider({});
      } catch (error) {
        expect((error as Error).message).toContain('GITHUB_TOKEN');
      }
    });
  });

  describe('createRepository', () => {
    it('should create repo under authenticated user when owner matches', async () => {
      mockOctokit.users.getAuthenticated.mockResolvedValue({
        data: { login: 'test-org' },
      });
      mockOctokit.repos.createForAuthenticatedUser.mockResolvedValue({
        data: {
          html_url: 'https://github.com/test-org/new-repo',
          clone_url: 'https://github.com/test-org/new-repo.git',
        },
      });

      const result = await provider.createRepository({
        provider: GitProvider.GITHUB,
        owner: 'test-org',
        name: 'new-repo',
        defaultBranch: 'main',
        isPrivate: true,
        description: 'My new repo',
      });

      expect(result.url).toBe('https://github.com/test-org/new-repo');
      expect(result.cloneUrl).toBe('https://github.com/test-org/new-repo.git');
      expect(mockOctokit.repos.createForAuthenticatedUser).toHaveBeenCalledWith({
        name: 'new-repo',
        description: 'My new repo',
        private: true,
        auto_init: true,
        default_branch: 'main',
      });
    });

    it('should create repo in org when owner differs from authenticated user', async () => {
      mockOctokit.users.getAuthenticated.mockResolvedValue({
        data: { login: 'my-user' },
      });
      mockOctokit.repos.createInOrg.mockResolvedValue({
        data: {
          html_url: 'https://github.com/other-org/repo',
          clone_url: 'https://github.com/other-org/repo.git',
        },
      });

      const result = await provider.createRepository({
        provider: GitProvider.GITHUB,
        owner: 'other-org',
        name: 'repo',
        defaultBranch: 'main',
        isPrivate: false,
      });

      expect(result.url).toBe('https://github.com/other-org/repo');
      expect(mockOctokit.repos.createInOrg).toHaveBeenCalledWith(
        expect.objectContaining({
          org: 'other-org',
          name: 'repo',
        }),
      );
    });
  });

  describe('cloneRepository', () => {
    it('should extract owner/repo from URL', async () => {
      mockOctokit.repos.get.mockResolvedValue({
        data: { default_branch: 'develop' },
      });

      await provider.cloneRepository('https://github.com/my-org/my-repo.git', '/tmp/repo');

      expect(mockOctokit.repos.get).toHaveBeenCalledWith({
        owner: 'my-org',
        repo: 'my-repo',
      });
    });

    it('should throw for invalid GitHub URL', async () => {
      await expect(
        provider.cloneRepository('https://bitbucket.org/user/repo', '/tmp'),
      ).rejects.toThrow('Invalid GitHub repository URL');
    });
  });

  describe('commit', () => {
    beforeEach(async () => {
      // Setup: createRepository to configure owner/repo
      mockOctokit.users.getAuthenticated.mockResolvedValue({
        data: { login: 'test-org' },
      });
      mockOctokit.repos.createForAuthenticatedUser.mockResolvedValue({
        data: {
          html_url: 'https://github.com/test-org/test-repo',
          clone_url: 'https://github.com/test-org/test-repo.git',
        },
      });
      await provider.createRepository({
        provider: GitProvider.GITHUB,
        owner: 'test-org',
        name: 'test-repo',
        defaultBranch: 'main',
        isPrivate: false,
      });
    });

    it('should commit files using Git Data API', async () => {
      const parentSha = 'aaaa'.repeat(10);
      const treeSha = 'bbbb'.repeat(10);
      const blobSha = 'cccc'.repeat(10);
      const newTreeSha = 'dddd'.repeat(10);
      const commitSha = 'eeee'.repeat(10);

      mockOctokit.git.getRef.mockResolvedValue({
        data: { object: { sha: parentSha } },
      });
      mockOctokit.git.getCommit.mockResolvedValue({
        data: { sha: parentSha, tree: { sha: treeSha } },
      });
      mockOctokit.git.createBlob.mockResolvedValue({
        data: { sha: blobSha },
      });
      mockOctokit.git.createTree.mockResolvedValue({
        data: { sha: newTreeSha },
      });
      mockOctokit.git.createCommit.mockResolvedValue({
        data: {
          sha: commitSha,
          message: 'feat: add files',
          author: { name: 'test-org', date: '2024-01-01T00:00:00Z' },
        },
      });
      mockOctokit.git.updateRef.mockResolvedValue({ data: {} });

      const result = await provider.commit(
        [
          { path: 'src/index.ts', content: 'export {}', operation: 'add' },
          { path: 'src/utils.ts', content: 'export const x = 1;', operation: 'modify' },
        ],
        'feat: add files',
        'main',
      );

      expect(result.sha).toBe(commitSha);
      expect(result.message).toBe('feat: add files');
      expect(result.files).toEqual(['src/index.ts', 'src/utils.ts']);

      // Verify blob creation for each file
      expect(mockOctokit.git.createBlob).toHaveBeenCalledTimes(2);

      // Verify tree creation
      expect(mockOctokit.git.createTree).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-org',
          repo: 'test-repo',
          base_tree: treeSha,
        }),
      );

      // Verify commit creation
      expect(mockOctokit.git.createCommit).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        message: 'feat: add files',
        tree: newTreeSha,
        parents: [parentSha],
      });

      // Verify ref update
      expect(mockOctokit.git.updateRef).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        ref: 'heads/main',
        sha: commitSha,
      });
    });

    it('should handle file deletions', async () => {
      const parentSha = 'aaaa'.repeat(10);
      const treeSha = 'bbbb'.repeat(10);
      const newTreeSha = 'dddd'.repeat(10);
      const commitSha = 'eeee'.repeat(10);

      mockOctokit.git.getRef.mockResolvedValue({
        data: { object: { sha: parentSha } },
      });
      mockOctokit.git.getCommit.mockResolvedValue({
        data: { sha: parentSha, tree: { sha: treeSha } },
      });
      mockOctokit.git.createTree.mockResolvedValue({
        data: { sha: newTreeSha },
      });
      mockOctokit.git.createCommit.mockResolvedValue({
        data: {
          sha: commitSha,
          message: 'chore: delete file',
          author: { name: 'test-org', date: '2024-01-01T00:00:00Z' },
        },
      });
      mockOctokit.git.updateRef.mockResolvedValue({ data: {} });

      const result = await provider.commit(
        [{ path: 'obsolete.ts', content: '', operation: 'delete' }],
        'chore: delete file',
      );

      // Should NOT create a blob for deletions
      expect(mockOctokit.git.createBlob).not.toHaveBeenCalled();
      expect(result.sha).toBe(commitSha);
    });
  });

  describe('push', () => {
    it('should be a no-op (commit already updates refs)', async () => {
      // push is a no-op, should not throw
      await expect(provider.push('main')).resolves.toBeUndefined();
    });
  });

  describe('pull', () => {
    beforeEach(async () => {
      mockOctokit.users.getAuthenticated.mockResolvedValue({
        data: { login: 'test-org' },
      });
      mockOctokit.repos.createForAuthenticatedUser.mockResolvedValue({
        data: {
          html_url: 'https://github.com/test-org/test-repo',
          clone_url: 'https://github.com/test-org/test-repo.git',
        },
      });
      await provider.createRepository({
        provider: GitProvider.GITHUB,
        owner: 'test-org',
        name: 'test-repo',
        defaultBranch: 'main',
        isPrivate: false,
      });
    });

    it('should list recent commits from the branch', async () => {
      mockOctokit.repos.listCommits.mockResolvedValue({
        data: [
          {
            sha: 'abc123',
            commit: {
              message: 'initial commit',
              author: { name: 'dev', date: '2024-01-01T00:00:00Z' },
            },
            author: { login: 'dev' },
          },
        ],
      });

      const commits = await provider.pull('main');

      expect(commits).toHaveLength(1);
      expect(commits[0].sha).toBe('abc123');
      expect(commits[0].message).toBe('initial commit');
      expect(mockOctokit.repos.listCommits).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        sha: 'main',
        per_page: 10,
      });
    });
  });

  describe('createBranch', () => {
    beforeEach(async () => {
      mockOctokit.users.getAuthenticated.mockResolvedValue({
        data: { login: 'test-org' },
      });
      mockOctokit.repos.createForAuthenticatedUser.mockResolvedValue({
        data: {
          html_url: 'https://github.com/test-org/test-repo',
          clone_url: 'https://github.com/test-org/test-repo.git',
        },
      });
      await provider.createRepository({
        provider: GitProvider.GITHUB,
        owner: 'test-org',
        name: 'test-repo',
        defaultBranch: 'main',
        isPrivate: false,
      });
    });

    it('should create a branch ref using Git Data API', async () => {
      const sha = 'abcdef'.repeat(7).slice(0, 40);
      mockOctokit.git.getRef.mockResolvedValue({
        data: { object: { sha } },
      });
      mockOctokit.git.createRef.mockResolvedValue({ data: {} });

      const branch = await provider.createBranch('feature/new', 'main');

      expect(branch.name).toBe('feature/new');
      expect(branch.sha).toBe(sha);
      expect(branch.isDefault).toBe(false);
      expect(branch.isProtected).toBe(false);

      expect(mockOctokit.git.getRef).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        ref: 'heads/main',
      });
      expect(mockOctokit.git.createRef).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        ref: 'refs/heads/feature/new',
        sha,
      });
    });
  });

  describe('listBranches', () => {
    beforeEach(async () => {
      mockOctokit.users.getAuthenticated.mockResolvedValue({
        data: { login: 'test-org' },
      });
      mockOctokit.repos.createForAuthenticatedUser.mockResolvedValue({
        data: {
          html_url: 'https://github.com/test-org/test-repo',
          clone_url: 'https://github.com/test-org/test-repo.git',
        },
      });
      await provider.createRepository({
        provider: GitProvider.GITHUB,
        owner: 'test-org',
        name: 'test-repo',
        defaultBranch: 'main',
        isPrivate: false,
      });
    });

    it('should list all branches', async () => {
      mockOctokit.repos.listBranches.mockResolvedValue({
        data: [
          { name: 'main', commit: { sha: 'abc' }, protected: true },
          { name: 'develop', commit: { sha: 'def' }, protected: false },
        ],
      });

      const branches = await provider.listBranches();

      expect(branches).toHaveLength(2);
      expect(branches[0].name).toBe('main');
      expect(branches[0].isDefault).toBe(true);
      expect(branches[0].isProtected).toBe(true);
      expect(branches[1].name).toBe('develop');
      expect(branches[1].isDefault).toBe(false);
    });
  });

  describe('createPullRequest', () => {
    beforeEach(async () => {
      mockOctokit.users.getAuthenticated.mockResolvedValue({
        data: { login: 'test-org' },
      });
      mockOctokit.repos.createForAuthenticatedUser.mockResolvedValue({
        data: {
          html_url: 'https://github.com/test-org/test-repo',
          clone_url: 'https://github.com/test-org/test-repo.git',
        },
      });
      await provider.createRepository({
        provider: GitProvider.GITHUB,
        owner: 'test-org',
        name: 'test-repo',
        defaultBranch: 'main',
        isPrivate: false,
      });
    });

    it('should create a pull request', async () => {
      mockOctokit.pulls.create.mockResolvedValue({
        data: {
          number: 42,
          title: 'Add feature',
          body: 'Description here',
          head: { ref: 'feature/new' },
          base: { ref: 'main' },
          user: { login: 'test-org' },
          created_at: '2024-01-15T00:00:00Z',
          requested_reviewers: [],
        },
      });

      const pr = await provider.createPullRequest({
        title: 'Add feature',
        description: 'Description here',
        sourceBranch: 'feature/new',
        targetBranch: 'main',
      });

      expect(pr.id).toBe('42');
      expect(pr.title).toBe('Add feature');
      expect(pr.description).toBe('Description here');
      expect(pr.sourceBranch).toBe('feature/new');
      expect(pr.targetBranch).toBe('main');
      expect(pr.status).toBe(PullRequestStatus.OPEN);
      expect(pr.author).toBe('test-org');

      expect(mockOctokit.pulls.create).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        title: 'Add feature',
        body: 'Description here',
        head: 'feature/new',
        base: 'main',
      });
    });

    it('should request reviewers when provided', async () => {
      mockOctokit.pulls.create.mockResolvedValue({
        data: {
          number: 43,
          title: 'PR with reviewers',
          body: '',
          head: { ref: 'feature/x' },
          base: { ref: 'main' },
          user: { login: 'test-org' },
          created_at: '2024-01-15T00:00:00Z',
          requested_reviewers: [],
        },
      });
      mockOctokit.pulls.requestReviewers.mockResolvedValue({ data: {} });

      await provider.createPullRequest({
        title: 'PR with reviewers',
        description: '',
        sourceBranch: 'feature/x',
        targetBranch: 'main',
        reviewers: ['reviewer1', 'reviewer2'],
      });

      expect(mockOctokit.pulls.requestReviewers).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        pull_number: 43,
        reviewers: ['reviewer1', 'reviewer2'],
      });
    });
  });

  describe('mergeBranch', () => {
    beforeEach(async () => {
      mockOctokit.users.getAuthenticated.mockResolvedValue({
        data: { login: 'test-org' },
      });
      mockOctokit.repos.createForAuthenticatedUser.mockResolvedValue({
        data: {
          html_url: 'https://github.com/test-org/test-repo',
          clone_url: 'https://github.com/test-org/test-repo.git',
        },
      });
      await provider.createRepository({
        provider: GitProvider.GITHUB,
        owner: 'test-org',
        name: 'test-repo',
        defaultBranch: 'main',
        isPrivate: false,
      });
    });

    it('should merge branches successfully', async () => {
      const mergeSha = 'merge123'.padEnd(40, '0');
      mockOctokit.repos.merge.mockResolvedValue({
        data: { sha: mergeSha },
      });

      const result = await provider.mergeBranch('feature/x', 'main');

      expect(result.success).toBe(true);
      expect(result.sha).toBe(mergeSha);
      expect(mockOctokit.repos.merge).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        base: 'main',
        head: 'feature/x',
        commit_message: 'Merged feature/x into main',
      });
    });

    it('should handle merge conflicts gracefully', async () => {
      mockOctokit.repos.merge.mockRejectedValue({ status: 409, message: 'Conflict' });

      const result = await provider.mergeBranch('feature/conflict', 'main');

      expect(result.success).toBe(false);
      expect(result.message).toContain('conflict');
    });
  });

  describe('getHistory', () => {
    beforeEach(async () => {
      mockOctokit.users.getAuthenticated.mockResolvedValue({
        data: { login: 'test-org' },
      });
      mockOctokit.repos.createForAuthenticatedUser.mockResolvedValue({
        data: {
          html_url: 'https://github.com/test-org/test-repo',
          clone_url: 'https://github.com/test-org/test-repo.git',
        },
      });
      await provider.createRepository({
        provider: GitProvider.GITHUB,
        owner: 'test-org',
        name: 'test-repo',
        defaultBranch: 'main',
        isPrivate: false,
      });
    });

    it('should list commits with options', async () => {
      mockOctokit.repos.listCommits.mockResolvedValue({
        data: [
          {
            sha: 'commit1',
            commit: {
              message: 'first',
              author: { name: 'dev', date: '2024-01-01T00:00:00Z' },
            },
            author: { login: 'dev' },
          },
          {
            sha: 'commit2',
            commit: {
              message: 'second',
              author: { name: 'dev', date: '2024-01-02T00:00:00Z' },
            },
            author: { login: 'dev' },
          },
        ],
      });

      const history = await provider.getHistory({ branch: 'main', limit: 10 });

      expect(history).toHaveLength(2);
      expect(history[0].sha).toBe('commit1');
      expect(mockOctokit.repos.listCommits).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-org',
          repo: 'test-repo',
          sha: 'main',
          per_page: 10,
        }),
      );
    });

    it('should pass date filters to API', async () => {
      mockOctokit.repos.listCommits.mockResolvedValue({ data: [] });

      const since = new Date('2024-01-01');
      const until = new Date('2024-02-01');

      await provider.getHistory({ since, until, path: 'src/' });

      expect(mockOctokit.repos.listCommits).toHaveBeenCalledWith(
        expect.objectContaining({
          since: since.toISOString(),
          until: until.toISOString(),
          path: 'src/',
        }),
      );
    });
  });

  describe('createRelease', () => {
    beforeEach(async () => {
      mockOctokit.users.getAuthenticated.mockResolvedValue({
        data: { login: 'test-org' },
      });
      mockOctokit.repos.createForAuthenticatedUser.mockResolvedValue({
        data: {
          html_url: 'https://github.com/test-org/test-repo',
          clone_url: 'https://github.com/test-org/test-repo.git',
        },
      });
      await provider.createRepository({
        provider: GitProvider.GITHUB,
        owner: 'test-org',
        name: 'test-repo',
        defaultBranch: 'main',
        isPrivate: false,
      });
    });

    it('should create a release', async () => {
      mockOctokit.repos.createRelease.mockResolvedValue({ data: {} });

      const release = await provider.createRelease({
        tag: 'v1.0.0',
        title: 'Release 1.0.0',
        body: 'First stable release',
        isDraft: false,
        isPrerelease: false,
      });

      expect(release.tag).toBe('v1.0.0');
      expect(mockOctokit.repos.createRelease).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
        tag_name: 'v1.0.0',
        name: 'Release 1.0.0',
        body: 'First stable release',
        draft: false,
        prerelease: false,
      });
    });
  });

  describe('error handling', () => {
    it('should throw when methods are called without configuration', async () => {
      const unconfiguredProvider = new GitHubProvider({ token: 'token', owner: '', repo: '' });

      await expect(unconfiguredProvider.commit([], 'msg')).rejects.toThrow(
        'not configured',
      );
      await expect(unconfiguredProvider.createBranch('test')).rejects.toThrow(
        'not configured',
      );
      await expect(unconfiguredProvider.listBranches()).rejects.toThrow(
        'not configured',
      );
    });
  });
});
