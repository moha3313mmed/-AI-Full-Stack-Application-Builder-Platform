import {
  DeploymentPipeline,
  DeploymentProvider as DeployProvider,
  DeploymentConfig,
  ProviderRegistry,
  VercelProvider,
  NetlifyProvider,
} from '@builder/deploy';
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

import { FilesService } from '../files/files.service';
import { PrismaService } from '../prisma/prisma.service';

import { CreateDeploymentDto } from './dto/create-deployment.dto';
import { UpdateDeploymentDto } from './dto/update-deployment.dto';

/**
 * Maps the DTO/Prisma provider enum string to the @builder/deploy package enum.
 * Validates that the provider string is a known value rather than using unsafe casts.
 */
function mapToDeployProvider(provider: string): DeployProvider {
  const mapping: Record<string, DeployProvider> = {
    VERCEL: DeployProvider.VERCEL,
    NETLIFY: DeployProvider.NETLIFY,
    RAILWAY: DeployProvider.RAILWAY,
    RENDER: DeployProvider.RENDER,
    FLY_IO: DeployProvider.FLY_IO,
    DIGITALOCEAN: DeployProvider.DIGITALOCEAN,
    AWS: DeployProvider.AWS,
    AZURE: DeployProvider.AZURE,
    GCP: DeployProvider.GCP,
    CLOUDFLARE: DeployProvider.CLOUDFLARE,
  };

  const mapped = mapping[provider];
  if (!mapped) {
    throw new Error(`Unknown deployment provider: "${provider}". Valid providers: ${Object.keys(mapping).join(', ')}`);
  }
  return mapped;
}

@Injectable()
export class DeployService {
  private registry: ProviderRegistry;
  private pipeline: DeploymentPipeline;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly filesService: FilesService,
  ) {
    this.registry = new ProviderRegistry();

    // Register Vercel provider with token from environment
    this.registry.register(DeployProvider.VERCEL, () => {
      const token = this.configService.get<string>('VERCEL_TOKEN');
      if (!token) {
        throw new Error('Vercel token not configured');
      }
      return new VercelProvider({
        token,
        teamId: this.configService.get<string>('VERCEL_TEAM_ID'),
      });
    });

    this.registry.register(DeployProvider.NETLIFY, () => new NetlifyProvider());
    this.pipeline = new DeploymentPipeline(this.registry, { autoRollback: true });
  }

  async create(dto: CreateDeploymentDto) {
    // Create deployment record in database
    const deployment = await this.prisma.deployment.create({
      data: {
        projectId: dto.projectId,
        provider: dto.provider,
        environment: dto.environment || 'production',
        config: (dto.config || {}) as Prisma.InputJsonValue,
        commitHash: dto.commitHash,
      },
    });

    // Execute deployment pipeline
    const config: DeploymentConfig = {
      provider: mapToDeployProvider(dto.provider),
      envVars: dto.envVars || {},
      buildCommand: dto.buildCommand || 'npm run build',
      outputDir: dto.outputDir || 'dist',
      region: dto.region,
      customDomain: dto.customDomain,
      projectId: dto.projectId,
      commitHash: dto.commitHash,
      files: this.collectProjectFiles(dto.projectId),
    };

    try {
      const result = await this.pipeline.execute(config);

      // Update deployment record with result
      return this.prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: 'DEPLOYED',
          url: result.url,
          logs: result.logs as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Update deployment as failed
      await this.prisma.deployment.update({
        where: { id: deployment.id },
        data: {
          status: 'FAILED',
          logs: [errorMessage] as unknown as Prisma.InputJsonValue,
        },
      });

      throw new InternalServerErrorException({
        message: 'Deployment failed',
        deploymentId: deployment.id,
        error: errorMessage,
      });
    }
  }

  async findById(id: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
    });

    if (!deployment) {
      throw new NotFoundException(`Deployment with id "${id}" not found`);
    }

    return deployment;
  }

  async findByProject(projectId: string, limit = 20, offset = 0) {
    const [items, total] = await Promise.all([
      this.prisma.deployment.findMany({
        where: { projectId },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.deployment.count({ where: { projectId } }),
    ]);

    return { items, total };
  }

  async update(id: string, dto: UpdateDeploymentDto) {
    const existing = await this.prisma.deployment.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Deployment with id "${id}" not found`);
    }

    return this.prisma.deployment.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.url !== undefined && { url: dto.url }),
        ...(dto.logs !== undefined && { logs: dto.logs as unknown as Prisma.InputJsonValue }),
        ...(dto.buildDuration !== undefined && { buildDuration: dto.buildDuration }),
        ...(dto.deployDuration !== undefined && { deployDuration: dto.deployDuration }),
      },
    });
  }

  async rollback(id: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
    });

    if (!deployment) {
      throw new NotFoundException(`Deployment with id "${id}" not found`);
    }

    // Create a new deployment record for the rollback
    return this.prisma.deployment.create({
      data: {
        projectId: deployment.projectId,
        provider: deployment.provider,
        environment: deployment.environment,
        config: deployment.config as Prisma.InputJsonValue,
        status: 'ROLLED_BACK',
        rollbackFromId: deployment.id,
        version: deployment.version + 1,
        logs: ['Rollback initiated', `Rolling back from deployment ${id}`] as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async getLogs(id: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
    });

    if (!deployment) {
      throw new NotFoundException(`Deployment with id "${id}" not found`);
    }

    return { deploymentId: id, logs: deployment.logs };
  }

  /**
   * Collect all files from the project VFS for deployment.
   * Recursively traverses directories to include all nested files.
   */
  private collectProjectFiles(projectId: string): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];

    try {
      const collectRecursive = (dirPath: string) => {
        const entries = this.filesService.listDirectory(projectId, dirPath);
        for (const entry of entries) {
          if (entry.type === 'file' && entry.content) {
            files.push({ path: entry.path, content: entry.content.text });
          } else if (entry.type === 'directory') {
            collectRecursive(entry.path);
          }
        }
      };

      collectRecursive('/');
    } catch {
      // VFS may not exist for this project; return empty to allow
      // settings-only deployment (e.g., git-linked projects)
    }

    return files;
  }
}
