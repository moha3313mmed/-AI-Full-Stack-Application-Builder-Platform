import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { FilesService } from '../files/files.service';
import { PrismaService } from '../prisma/prisma.service';

import { DeployService } from './deploy.service';
import { CreateDeploymentDto, DeploymentProviderDto } from './dto/create-deployment.dto';

// Mock the @builder/deploy package to avoid real API calls
const mockExecute = jest.fn();
const mockExecuteWithRollback = jest.fn();

jest.mock('@builder/deploy', () => {
  const actual = jest.requireActual('@builder/deploy');
  return {
    ...actual,
    VercelProvider: jest.fn().mockImplementation(() => ({})),
    NetlifyProvider: jest.fn().mockImplementation(() => ({})),
    DeploymentPipeline: jest.fn().mockImplementation(() => ({
      execute: mockExecute,
      executeWithRollback: mockExecuteWithRollback,
      onEvent: jest.fn(),
    })),
    ProviderRegistry: jest.fn().mockImplementation(() => ({
      register: jest.fn(),
      get: jest.fn(),
      has: jest.fn(),
      listAvailable: jest.fn(),
    })),
  };
});

describe('DeployService', () => {
  let service: DeployService;

  const mockPrismaService = {
    deployment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        VERCEL_TOKEN: 'test-vercel-token',
        VERCEL_TEAM_ID: 'test-team-id',
      };
      return config[key];
    }),
  };

  const mockFilesService = {
    listDirectory: jest.fn().mockReturnValue([
      { path: '/index.html', type: 'file', name: 'index.html', content: { text: '<html></html>', language: 'html' } },
    ]),
    getProjectFS: jest.fn().mockReturnValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeployService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: FilesService, useValue: mockFilesService },
      ],
    }).compile();

    service = module.get<DeployService>(DeployService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a deployment and execute pipeline', async () => {
      const dto: CreateDeploymentDto = {
        projectId: 'proj-1',
        provider: DeploymentProviderDto.VERCEL,
        buildCommand: 'npm run build',
        outputDir: '.next',
      };

      const createdDeployment = {
        id: 'deploy-1',
        projectId: 'proj-1',
        provider: 'VERCEL',
        status: 'PENDING',
        environment: 'production',
        config: {},
        createdAt: new Date(),
      };

      const updatedDeployment = {
        ...createdDeployment,
        status: 'DEPLOYED',
        url: 'https://proj-1-abc12345.vercel.app',
      };

      mockPrismaService.deployment.create.mockResolvedValue(createdDeployment);
      mockPrismaService.deployment.update.mockResolvedValue(updatedDeployment);
      mockExecute.mockResolvedValue({
        id: 'vercel-deploy-1',
        url: 'https://proj-1-abc12345.vercel.app',
        status: 'DEPLOYED',
        logs: ['[info] Deployment created'],
        startedAt: new Date(),
        completedAt: new Date(),
      });

      const result = await service.create(dto);

      expect(mockPrismaService.deployment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          provider: 'VERCEL',
          environment: 'production',
        }),
      });
      expect(result.status).toBe('DEPLOYED');
    });

    it('should create deployment with custom environment', async () => {
      const dto: CreateDeploymentDto = {
        projectId: 'proj-1',
        provider: DeploymentProviderDto.NETLIFY,
        environment: 'staging',
        buildCommand: 'npm run build',
        outputDir: 'dist',
      };

      const createdDeployment = {
        id: 'deploy-2',
        projectId: 'proj-1',
        provider: 'NETLIFY',
        status: 'PENDING',
        environment: 'staging',
        config: {},
      };

      mockPrismaService.deployment.create.mockResolvedValue(createdDeployment);
      mockPrismaService.deployment.update.mockResolvedValue({
        ...createdDeployment,
        status: 'DEPLOYED',
      });
      mockExecute.mockResolvedValue({
        id: 'netlify-deploy-1',
        url: 'https://proj-1.netlify.app',
        status: 'DEPLOYED',
        logs: ['[info] Deployment created'],
        startedAt: new Date(),
        completedAt: new Date(),
      });

      const result = await service.create(dto);

      expect(mockPrismaService.deployment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          environment: 'staging',
        }),
      });
      expect(result.status).toBe('DEPLOYED');
    });

    it('should mark deployment as FAILED and throw when pipeline throws', async () => {
      const dto: CreateDeploymentDto = {
        projectId: 'proj-1',
        provider: 'RAILWAY' as DeploymentProviderDto,
        buildCommand: 'npm run build',
        outputDir: 'dist',
      };

      const createdDeployment = {
        id: 'deploy-3',
        projectId: 'proj-1',
        provider: 'RAILWAY',
        status: 'PENDING',
      };

      const failedDeployment = {
        ...createdDeployment,
        status: 'FAILED',
        logs: ['Provider "RAILWAY" is not registered. Available providers: VERCEL, NETLIFY'],
      };

      mockPrismaService.deployment.create.mockResolvedValue(createdDeployment);
      mockPrismaService.deployment.update.mockResolvedValue(failedDeployment);
      mockExecute.mockRejectedValue(
        new Error('Provider "RAILWAY" is not registered. Available providers: VERCEL, NETLIFY'),
      );

      await expect(service.create(dto)).rejects.toThrow();
      expect(mockPrismaService.deployment.update).toHaveBeenCalledWith({
        where: { id: 'deploy-3' },
        data: expect.objectContaining({
          status: 'FAILED',
        }),
      });
    });
  });

  describe('findById', () => {
    it('should return a deployment by id', async () => {
      const expected = {
        id: 'deploy-1',
        projectId: 'proj-1',
        provider: 'VERCEL',
        status: 'DEPLOYED',
        url: 'https://example.vercel.app',
      };

      mockPrismaService.deployment.findUnique.mockResolvedValue(expected);

      const result = await service.findById('deploy-1');

      expect(result).toEqual(expected);
      expect(mockPrismaService.deployment.findUnique).toHaveBeenCalledWith({
        where: { id: 'deploy-1' },
      });
    });

    it('should throw NotFoundException when deployment does not exist', async () => {
      mockPrismaService.deployment.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByProject', () => {
    it('should return deployments for a project', async () => {
      const items = [
        { id: 'deploy-1', projectId: 'proj-1', status: 'DEPLOYED' },
        { id: 'deploy-2', projectId: 'proj-1', status: 'FAILED' },
      ];

      mockPrismaService.deployment.findMany.mockResolvedValue(items);
      mockPrismaService.deployment.count.mockResolvedValue(2);

      const result = await service.findByProject('proj-1');

      expect(result).toEqual({ items, total: 2 });
      expect(mockPrismaService.deployment.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        take: 20,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should respect limit and offset', async () => {
      mockPrismaService.deployment.findMany.mockResolvedValue([]);
      mockPrismaService.deployment.count.mockResolvedValue(0);

      await service.findByProject('proj-1', 10, 5);

      expect(mockPrismaService.deployment.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        take: 10,
        skip: 5,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('rollback', () => {
    it('should create a rollback deployment record', async () => {
      const existing = {
        id: 'deploy-1',
        projectId: 'proj-1',
        provider: 'VERCEL',
        environment: 'production',
        config: { buildCommand: 'npm run build' },
        version: 3,
      };

      const rollbackResult = {
        id: 'deploy-4',
        projectId: 'proj-1',
        provider: 'VERCEL',
        status: 'ROLLED_BACK',
        rollbackFromId: 'deploy-1',
        version: 4,
      };

      mockPrismaService.deployment.findUnique.mockResolvedValue(existing);
      mockPrismaService.deployment.create.mockResolvedValue(rollbackResult);

      const result = await service.rollback('deploy-1');

      expect(result.status).toBe('ROLLED_BACK');
      expect(result.rollbackFromId).toBe('deploy-1');
      expect(mockPrismaService.deployment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          provider: 'VERCEL',
          status: 'ROLLED_BACK',
          rollbackFromId: 'deploy-1',
          version: 4,
        }),
      });
    });

    it('should throw NotFoundException when deployment does not exist', async () => {
      mockPrismaService.deployment.findUnique.mockResolvedValue(null);

      await expect(service.rollback('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getLogs', () => {
    it('should return deployment logs', async () => {
      const deployment = {
        id: 'deploy-1',
        logs: ['[info] Build started', '[info] Build completed', '[info] Deployed'],
      };

      mockPrismaService.deployment.findUnique.mockResolvedValue(deployment);

      const result = await service.getLogs('deploy-1');

      expect(result).toEqual({
        deploymentId: 'deploy-1',
        logs: ['[info] Build started', '[info] Build completed', '[info] Deployed'],
      });
    });

    it('should throw NotFoundException when deployment does not exist', async () => {
      mockPrismaService.deployment.findUnique.mockResolvedValue(null);

      await expect(service.getLogs('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update deployment status', async () => {
      const existing = {
        id: 'deploy-1',
        status: 'BUILDING',
      };

      const updated = {
        id: 'deploy-1',
        status: 'DEPLOYED',
        url: 'https://example.vercel.app',
      };

      mockPrismaService.deployment.findUnique.mockResolvedValue(existing);
      mockPrismaService.deployment.update.mockResolvedValue(updated);

      const result = await service.update('deploy-1', {
        status: 'DEPLOYED' as never,
        url: 'https://example.vercel.app',
      });

      expect(result.status).toBe('DEPLOYED');
      expect(result.url).toBe('https://example.vercel.app');
    });

    it('should throw NotFoundException when deployment does not exist', async () => {
      mockPrismaService.deployment.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { url: 'https://test.com' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
