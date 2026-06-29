import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';

import { InstallPluginDto } from './dto/install-plugin.dto';
import { PluginsService } from './plugins.service';

describe('PluginsService', () => {
  let service: PluginsService;

  const mockPrismaService = {
    plugin: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    pluginInstallation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PluginsService>(PluginsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('install', () => {
    const dto: InstallPluginDto = {
      pluginId: 'plugin-1',
      projectId: 'proj-1',
      config: { theme: 'dark' },
    };

    it('should install a plugin for a project', async () => {
      const plugin = { id: 'plugin-1', name: 'Test Plugin', slug: 'test-plugin' };
      const installation = {
        id: 'install-1',
        pluginId: 'plugin-1',
        projectId: 'proj-1',
        status: 'INSTALLED',
        config: { theme: 'dark' },
        plugin,
      };

      mockPrismaService.plugin.findUnique.mockResolvedValue(plugin);
      mockPrismaService.pluginInstallation.findUnique.mockResolvedValue(null);
      mockPrismaService.pluginInstallation.create.mockResolvedValue(installation);

      const result = await service.install(dto);

      expect(result).toEqual(installation);
      expect(mockPrismaService.pluginInstallation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pluginId: 'plugin-1',
          projectId: 'proj-1',
          status: 'INSTALLED',
        }),
        include: { plugin: true },
      });
    });

    it('should throw NotFoundException when plugin does not exist', async () => {
      mockPrismaService.plugin.findUnique.mockResolvedValue(null);

      await expect(service.install(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when plugin is already installed', async () => {
      const plugin = { id: 'plugin-1', name: 'Test Plugin' };
      const existing = { id: 'install-1', pluginId: 'plugin-1', projectId: 'proj-1' };

      mockPrismaService.plugin.findUnique.mockResolvedValue(plugin);
      mockPrismaService.pluginInstallation.findUnique.mockResolvedValue(existing);

      await expect(service.install(dto)).rejects.toThrow(BadRequestException);
    });

    it('should install with default empty config when none provided', async () => {
      const dtoNoConfig: InstallPluginDto = { pluginId: 'plugin-1', projectId: 'proj-1' };
      const plugin = { id: 'plugin-1', name: 'Test Plugin' };
      const installation = {
        id: 'install-2',
        pluginId: 'plugin-1',
        projectId: 'proj-1',
        status: 'INSTALLED',
        config: {},
        plugin,
      };

      mockPrismaService.plugin.findUnique.mockResolvedValue(plugin);
      mockPrismaService.pluginInstallation.findUnique.mockResolvedValue(null);
      mockPrismaService.pluginInstallation.create.mockResolvedValue(installation);

      const result = await service.install(dtoNoConfig);

      expect(result.config).toEqual({});
    });
  });

  describe('activate', () => {
    it('should activate an installed plugin', async () => {
      const installation = { id: 'install-1', status: 'INSTALLED' };
      const activated = {
        id: 'install-1',
        status: 'ACTIVE',
        activatedAt: new Date(),
        plugin: { name: 'Test Plugin' },
      };

      mockPrismaService.pluginInstallation.findUnique.mockResolvedValue(installation);
      mockPrismaService.pluginInstallation.update.mockResolvedValue(activated);

      const result = await service.activate('install-1');

      expect(result.status).toBe('ACTIVE');
      expect(mockPrismaService.pluginInstallation.update).toHaveBeenCalledWith({
        where: { id: 'install-1' },
        data: expect.objectContaining({ status: 'ACTIVE' }),
        include: { plugin: true },
      });
    });

    it('should throw NotFoundException when installation does not exist', async () => {
      mockPrismaService.pluginInstallation.findUnique.mockResolvedValue(null);

      await expect(service.activate('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when plugin is already active', async () => {
      const installation = { id: 'install-1', status: 'ACTIVE' };
      mockPrismaService.pluginInstallation.findUnique.mockResolvedValue(installation);

      await expect(service.activate('install-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('deactivate', () => {
    it('should deactivate an active plugin', async () => {
      const installation = { id: 'install-1', status: 'ACTIVE' };
      const deactivated = {
        id: 'install-1',
        status: 'INACTIVE',
        plugin: { name: 'Test Plugin' },
      };

      mockPrismaService.pluginInstallation.findUnique.mockResolvedValue(installation);
      mockPrismaService.pluginInstallation.update.mockResolvedValue(deactivated);

      const result = await service.deactivate('install-1');

      expect(result.status).toBe('INACTIVE');
    });

    it('should throw NotFoundException when installation does not exist', async () => {
      mockPrismaService.pluginInstallation.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when plugin is already inactive', async () => {
      const installation = { id: 'install-1', status: 'INACTIVE' };
      mockPrismaService.pluginInstallation.findUnique.mockResolvedValue(installation);

      await expect(service.deactivate('install-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('uninstall', () => {
    it('should uninstall a plugin', async () => {
      const installation = { id: 'install-1', pluginId: 'plugin-1', projectId: 'proj-1' };

      mockPrismaService.pluginInstallation.findUnique.mockResolvedValue(installation);
      mockPrismaService.pluginInstallation.delete.mockResolvedValue(installation);

      const result = await service.uninstall('install-1');

      expect(result).toEqual(installation);
      expect(mockPrismaService.pluginInstallation.delete).toHaveBeenCalledWith({
        where: { id: 'install-1' },
      });
    });

    it('should throw NotFoundException when installation does not exist', async () => {
      mockPrismaService.pluginInstallation.findUnique.mockResolvedValue(null);

      await expect(service.uninstall('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all plugin installations', async () => {
      const items = [
        { id: 'install-1', pluginId: 'plugin-1', plugin: { name: 'Plugin A' } },
        { id: 'install-2', pluginId: 'plugin-2', plugin: { name: 'Plugin B' } },
      ];

      mockPrismaService.pluginInstallation.findMany.mockResolvedValue(items);

      const result = await service.findAll();

      expect(result).toEqual({ items, total: 2 });
    });

    it('should filter by projectId', async () => {
      mockPrismaService.pluginInstallation.findMany.mockResolvedValue([]);

      await service.findAll('proj-1');

      expect(mockPrismaService.pluginInstallation.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        include: { plugin: true },
        orderBy: { installedAt: 'desc' },
      });
    });

    it('should filter by status', async () => {
      mockPrismaService.pluginInstallation.findMany.mockResolvedValue([]);

      await service.findAll(undefined, 'ACTIVE');

      expect(mockPrismaService.pluginInstallation.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        include: { plugin: true },
        orderBy: { installedAt: 'desc' },
      });
    });
  });

  describe('findById', () => {
    it('should return a plugin installation by id', async () => {
      const installation = {
        id: 'install-1',
        pluginId: 'plugin-1',
        plugin: { name: 'Test Plugin' },
      };

      mockPrismaService.pluginInstallation.findUnique.mockResolvedValue(installation);

      const result = await service.findById('install-1');

      expect(result).toEqual(installation);
    });

    it('should throw NotFoundException when installation does not exist', async () => {
      mockPrismaService.pluginInstallation.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateConfig', () => {
    it('should update the plugin configuration', async () => {
      const installation = { id: 'install-1', config: { theme: 'dark' } };
      const updated = {
        id: 'install-1',
        config: { theme: 'light', fontSize: 14 },
        plugin: { name: 'Test Plugin' },
      };

      mockPrismaService.pluginInstallation.findUnique.mockResolvedValue(installation);
      mockPrismaService.pluginInstallation.update.mockResolvedValue(updated);

      const result = await service.updateConfig('install-1', {
        config: { theme: 'light', fontSize: 14 },
      });

      expect(result.config).toEqual({ theme: 'light', fontSize: 14 });
    });

    it('should throw NotFoundException when installation does not exist', async () => {
      mockPrismaService.pluginInstallation.findUnique.mockResolvedValue(null);

      await expect(
        service.updateConfig('non-existent', { config: { key: 'value' } }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
