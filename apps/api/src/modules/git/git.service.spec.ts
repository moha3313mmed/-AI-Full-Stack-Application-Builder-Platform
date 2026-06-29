import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';

import { CommitDto } from './dto/commit.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateRepositoryDto, GitProviderDto } from './dto/create-repository.dto';
import { GitService } from './git.service';

// Mock the RepositoryManager from @builder/git to avoid real API calls
const mockProvider = {
  createPullRequest: jest.fn(),
  listPullRequests: jest.fn(),
};

const mockManagerInstance = {
  init: jest.fn().mockResolvedValue({
    url: 'https://github.com/test-org/test-repo',
    cloneUrl: 'https://github.com/test-org/test-repo.git',
  }),
  commitFiles: jest.fn().mockResolvedValue({
    sha: 'abc123def456',
    message: 'test commit',
    author: 'test-org',
    date: new Date(),
    files: ['src/app.ts'],
  }),
  createBranch: jest.fn().mockResolvedValue({
    name: 'feature/new-feature',
    sha: 'abc123',
    isDefault: false,
    isProtected: false,
  }),
  getProvider: jest.fn().mockReturnValue(mockProvider),
};

jest.mock('@builder/git', () => {
  const actual = jest.requireActual('@builder/git');
  return {
    ...actual,
    RepositoryManager: jest.fn().mockImplementation(() => mockManagerInstance),
  };
});

describe('GitService', () => {
  let service: GitService;

  const mockPrismaService = {
    gitRepository: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    gitCommit: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    gitBranch: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('fake-github-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<GitService>(GitService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRepository', () => {
    it('should create a repository and store in database', async () => {
      const dto: CreateRepositoryDto = {
        projectId: 'proj-1',
        provider: GitProviderDto.GITHUB,
        owner: 'test-org',
        name: 'test-repo',
        defaultBranch: 'main',
        isPrivate: false,
      };

      const createdRepo = {
        id: 'repo-1',
        projectId: 'proj-1',
        provider: 'GITHUB',
        remoteUrl: 'https://github.com/test-org/test-repo.git',
        owner: 'test-org',
        name: 'test-repo',
        defaultBranch: 'main',
        isPrivate: false,
        createdAt: new Date(),
      };

      mockPrismaService.gitRepository.create.mockResolvedValue(createdRepo);

      const result = await service.createRepository(dto);

      expect(mockPrismaService.gitRepository.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          provider: 'GITHUB',
          owner: 'test-org',
          name: 'test-repo',
          defaultBranch: 'main',
        }),
      });
      expect(result).toEqual(createdRepo);
    });

    it('should create a GitLab repository', async () => {
      const dto: CreateRepositoryDto = {
        projectId: 'proj-2',
        provider: GitProviderDto.GITLAB,
        owner: 'my-group',
        name: 'my-project',
      };

      const createdRepo = {
        id: 'repo-2',
        projectId: 'proj-2',
        provider: 'GITLAB',
        remoteUrl: 'https://gitlab.com/my-group/my-project.git',
        owner: 'my-group',
        name: 'my-project',
        defaultBranch: 'main',
        isPrivate: false,
      };

      mockPrismaService.gitRepository.create.mockResolvedValue(createdRepo);

      const result = await service.createRepository(dto);

      expect(result.provider).toBe('GITLAB');
    });
  });

  describe('findByProject', () => {
    it('should return a repository by project ID', async () => {
      const expected = {
        id: 'repo-1',
        projectId: 'proj-1',
        provider: 'GITHUB',
        owner: 'test-org',
        name: 'test-repo',
        branches: [],
      };

      mockPrismaService.gitRepository.findUnique.mockResolvedValue(expected);

      const result = await service.findByProject('proj-1');

      expect(result).toEqual(expected);
      expect(mockPrismaService.gitRepository.findUnique).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        include: { branches: true },
      });
    });

    it('should throw NotFoundException when repository does not exist', async () => {
      mockPrismaService.gitRepository.findUnique.mockResolvedValue(null);

      await expect(service.findByProject('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('commit', () => {
    const repository = {
      id: 'repo-1',
      projectId: 'proj-1',
      provider: 'GITHUB',
      owner: 'test-org',
      name: 'test-repo',
      defaultBranch: 'main',
      isPrivate: false,
    };

    it('should commit files and store in database', async () => {
      const dto: CommitDto = {
        message: 'feat: add new feature',
        files: [
          { path: 'src/app.ts', content: 'export class App {}', operation: 'add' },
        ],
      };

      mockPrismaService.gitRepository.findUnique.mockResolvedValue(repository);
      mockPrismaService.gitCommit.create.mockResolvedValue({
        id: 'commit-1',
        repositoryId: 'repo-1',
        sha: 'abc123',
        message: 'feat: add new feature',
        authorName: 'test-org',
        authorEmail: 'test-org@example.com',
        filesChanged: ['src/app.ts'],
      });

      const result = await service.commit('proj-1', dto);

      expect(result.message).toBe('feat: add new feature');
      expect(mockPrismaService.gitCommit.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when repository does not exist', async () => {
      mockPrismaService.gitRepository.findUnique.mockResolvedValue(null);

      const dto: CommitDto = {
        message: 'test',
        files: [{ path: 'file.ts', content: 'content', operation: 'add' }],
      };

      await expect(service.commit('non-existent', dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createBranch', () => {
    const repository = {
      id: 'repo-1',
      projectId: 'proj-1',
      provider: 'GITHUB',
      owner: 'test-org',
      name: 'test-repo',
      defaultBranch: 'main',
      isPrivate: false,
    };

    it('should create a branch and store in database', async () => {
      const dto: CreateBranchDto = {
        name: 'feature/new-feature',
      };

      mockPrismaService.gitRepository.findUnique.mockResolvedValue(repository);
      mockPrismaService.gitBranch.create.mockResolvedValue({
        id: 'branch-1',
        repositoryId: 'repo-1',
        name: 'feature/new-feature',
        sha: 'abc123',
        isDefault: false,
        isProtected: false,
      });

      const result = await service.createBranch('proj-1', dto);

      expect(result.name).toBe('feature/new-feature');
      expect(mockPrismaService.gitBranch.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when repository does not exist', async () => {
      mockPrismaService.gitRepository.findUnique.mockResolvedValue(null);

      await expect(
        service.createBranch('non-existent', { name: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listBranches', () => {
    it('should return branches for a repository', async () => {
      const repository = { id: 'repo-1', projectId: 'proj-1' };
      const branches = [
        { id: 'b-1', name: 'main', isDefault: true },
        { id: 'b-2', name: 'develop', isDefault: false },
      ];

      mockPrismaService.gitRepository.findUnique.mockResolvedValue(repository);
      mockPrismaService.gitBranch.findMany.mockResolvedValue(branches);

      const result = await service.listBranches('proj-1');

      expect(result).toEqual(branches);
      expect(mockPrismaService.gitBranch.findMany).toHaveBeenCalledWith({
        where: { repositoryId: 'repo-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw NotFoundException when repository does not exist', async () => {
      mockPrismaService.gitRepository.findUnique.mockResolvedValue(null);

      await expect(service.listBranches('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getHistory', () => {
    it('should return commit history with pagination', async () => {
      const repository = { id: 'repo-1', projectId: 'proj-1' };
      const commits = [
        { id: 'c-1', sha: 'abc', message: 'first' },
        { id: 'c-2', sha: 'def', message: 'second' },
      ];

      mockPrismaService.gitRepository.findUnique.mockResolvedValue(repository);
      mockPrismaService.gitCommit.findMany.mockResolvedValue(commits);
      mockPrismaService.gitCommit.count.mockResolvedValue(2);

      const result = await service.getHistory('proj-1');

      expect(result).toEqual({ items: commits, total: 2 });
      expect(mockPrismaService.gitCommit.findMany).toHaveBeenCalledWith({
        where: { repositoryId: 'repo-1' },
        take: 20,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should respect limit and offset parameters', async () => {
      const repository = { id: 'repo-1', projectId: 'proj-1' };

      mockPrismaService.gitRepository.findUnique.mockResolvedValue(repository);
      mockPrismaService.gitCommit.findMany.mockResolvedValue([]);
      mockPrismaService.gitCommit.count.mockResolvedValue(0);

      await service.getHistory('proj-1', 10, 5);

      expect(mockPrismaService.gitCommit.findMany).toHaveBeenCalledWith({
        where: { repositoryId: 'repo-1' },
        take: 10,
        skip: 5,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw NotFoundException when repository does not exist', async () => {
      mockPrismaService.gitRepository.findUnique.mockResolvedValue(null);

      await expect(service.getHistory('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
