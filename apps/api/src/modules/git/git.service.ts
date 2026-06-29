import {
  RepositoryManager,
  GitProvider,
  RepositoryConfig,
  FileChange,
} from '@builder/git';
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CommitDto } from './dto/commit.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateRepositoryDto } from './dto/create-repository.dto';

/**
 * Maps the DTO/Prisma provider enum string to the @builder/git package enum.
 * Validates that the provider string is a known value rather than using unsafe casts.
 */
function mapToGitProvider(provider: string): GitProvider {
  const mapping: Record<string, GitProvider> = {
    GITHUB: GitProvider.GITHUB,
    GITLAB: GitProvider.GITLAB,
    BITBUCKET: GitProvider.BITBUCKET,
  };

  const mapped = mapping[provider];
  if (!mapped) {
    throw new InternalServerErrorException(
      `Unknown git provider: "${provider}". Valid providers: ${Object.keys(mapping).join(', ')}`
    );
  }
  return mapped;
}

@Injectable()
export class GitService {
  /** Maximum number of repository managers to cache in memory. */
  private static readonly MAX_MANAGERS = 100;

  private managers: Map<string, RepositoryManager> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get a cached manager or create one, evicting the oldest entry
   * if the cache exceeds MAX_MANAGERS (simple LRU eviction).
   */
  private setCachedManager(projectId: string, manager: RepositoryManager): void {
    // If already in the map, delete first to refresh insertion order
    if (this.managers.has(projectId)) {
      this.managers.delete(projectId);
    }

    // Evict oldest entries if we exceed max size
    while (this.managers.size >= GitService.MAX_MANAGERS) {
      const oldestKey = this.managers.keys().next().value;
      if (oldestKey) {
        this.managers.delete(oldestKey);
      }
    }

    this.managers.set(projectId, manager);
  }

  async createRepository(dto: CreateRepositoryDto) {
    const config: RepositoryConfig = {
      provider: mapToGitProvider(dto.provider),
      owner: dto.owner,
      name: dto.name,
      defaultBranch: dto.defaultBranch || 'main',
      isPrivate: dto.isPrivate || false,
      description: dto.description,
    };

    // Initialize repository via provider
    const manager = new RepositoryManager({
      githubToken: this.configService.get<string>('GITHUB_TOKEN'),
    });
    const result = await manager.init(config);

    // Store in database
    const repository = await this.prisma.gitRepository.create({
      data: {
        projectId: dto.projectId,
        provider: dto.provider,
        remoteUrl: result.cloneUrl,
        owner: dto.owner,
        name: dto.name,
        defaultBranch: dto.defaultBranch || 'main',
        isPrivate: dto.isPrivate || false,
      },
    });

    // Cache the manager
    this.setCachedManager(dto.projectId, manager);

    return repository;
  }

  async findByProject(projectId: string) {
    const repository = await this.prisma.gitRepository.findUnique({
      where: { projectId },
      include: { branches: true },
    });

    if (!repository) {
      throw new NotFoundException(`Git repository for project "${projectId}" not found`);
    }

    return repository;
  }

  async commit(projectId: string, dto: CommitDto) {
    const repository = await this.prisma.gitRepository.findUnique({
      where: { projectId },
    });

    if (!repository) {
      throw new NotFoundException(`Git repository for project "${projectId}" not found`);
    }

    // Get or create manager
    const manager = await this.getManager(projectId, repository);

    // Commit files
    const files: FileChange[] = dto.files.map((f) => ({
      path: f.path,
      content: f.content,
      operation: f.operation,
    }));

    const commitResult = await manager.commitFiles(files, dto.message, dto.branch);

    // Store commit in database
    const commit = await this.prisma.gitCommit.create({
      data: {
        repositoryId: repository.id,
        sha: commitResult.sha,
        message: commitResult.message,
        authorName: commitResult.author,
        authorEmail: `${commitResult.author}@example.com`,
        filesChanged: commitResult.files as unknown as Prisma.InputJsonValue,
      },
    });

    return commit;
  }

  async createBranch(projectId: string, dto: CreateBranchDto) {
    const repository = await this.prisma.gitRepository.findUnique({
      where: { projectId },
    });

    if (!repository) {
      throw new NotFoundException(`Git repository for project "${projectId}" not found`);
    }

    const manager = await this.getManager(projectId, repository);
    const branchResult = await manager.createBranch(dto.name, dto.from, false);

    // Store branch in database
    const branch = await this.prisma.gitBranch.create({
      data: {
        repositoryId: repository.id,
        name: branchResult.name,
        sha: branchResult.sha,
        isDefault: branchResult.isDefault,
        isProtected: branchResult.isProtected,
      },
    });

    return branch;
  }

  async listBranches(projectId: string) {
    const repository = await this.prisma.gitRepository.findUnique({
      where: { projectId },
    });

    if (!repository) {
      throw new NotFoundException(`Git repository for project "${projectId}" not found`);
    }

    return this.prisma.gitBranch.findMany({
      where: { repositoryId: repository.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPullRequest(projectId: string, data: { title: string; description: string; sourceBranch: string; targetBranch: string; reviewers?: string[] }) {
    const repository = await this.prisma.gitRepository.findUnique({
      where: { projectId },
    });

    if (!repository) {
      throw new NotFoundException(`Git repository for project "${projectId}" not found`);
    }

    const manager = await this.getManager(projectId, repository);
    const provider = manager.getProvider();

    if (!provider) {
      throw new Error('Git provider not available');
    }

    const pr = await provider.createPullRequest({
      title: data.title,
      description: data.description,
      sourceBranch: data.sourceBranch,
      targetBranch: data.targetBranch,
      reviewers: data.reviewers,
    });

    return pr;
  }

  async getHistory(projectId: string, limit = 20, offset = 0) {
    const repository = await this.prisma.gitRepository.findUnique({
      where: { projectId },
    });

    if (!repository) {
      throw new NotFoundException(`Git repository for project "${projectId}" not found`);
    }

    const [items, total] = await Promise.all([
      this.prisma.gitCommit.findMany({
        where: { repositoryId: repository.id },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.gitCommit.count({ where: { repositoryId: repository.id } }),
    ]);

    return { items, total };
  }

  private async getManager(projectId: string, repository: { provider: string; owner: string; name: string; defaultBranch: string; isPrivate: boolean }): Promise<RepositoryManager> {
    if (this.managers.has(projectId)) {
      // Refresh position in the map for LRU behavior
      const manager = this.managers.get(projectId)!;
      this.managers.delete(projectId);
      this.managers.set(projectId, manager);
      return manager;
    }

    // Re-create manager from stored config
    const manager = new RepositoryManager({
      githubToken: this.configService.get<string>('GITHUB_TOKEN'),
    });
    const config: RepositoryConfig = {
      provider: mapToGitProvider(repository.provider),
      owner: repository.owner,
      name: repository.name,
      defaultBranch: repository.defaultBranch,
      isPrivate: repository.isPrivate,
    };

    await manager.init(config);
    this.setCachedManager(projectId, manager);
    return manager;
  }
}
