import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { InstallPluginDto } from './dto/install-plugin.dto';
import { UpdatePluginConfigDto } from './dto/update-plugin-config.dto';

@Injectable()
export class PluginsService {
  constructor(private readonly prisma: PrismaService) {}

  async install(dto: InstallPluginDto) {
    // Verify the plugin exists
    const plugin = await this.prisma.plugin.findUnique({
      where: { id: dto.pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin with id "${dto.pluginId}" not found`);
    }

    // Check if already installed for this project
    const existing = await this.prisma.pluginInstallation.findUnique({
      where: {
        pluginId_projectId: {
          pluginId: dto.pluginId,
          projectId: dto.projectId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Plugin "${dto.pluginId}" is already installed for project "${dto.projectId}"`,
      );
    }

    return this.prisma.pluginInstallation.create({
      data: {
        pluginId: dto.pluginId,
        projectId: dto.projectId,
        config: (dto.config || {}) as Prisma.InputJsonValue,
        status: 'INSTALLED',
      },
      include: { plugin: true },
    });
  }

  async activate(id: string) {
    const installation = await this.prisma.pluginInstallation.findUnique({
      where: { id },
    });

    if (!installation) {
      throw new NotFoundException(`Plugin installation with id "${id}" not found`);
    }

    if (installation.status === 'ACTIVE') {
      throw new BadRequestException('Plugin is already active');
    }

    return this.prisma.pluginInstallation.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        activatedAt: new Date(),
      },
      include: { plugin: true },
    });
  }

  async deactivate(id: string) {
    const installation = await this.prisma.pluginInstallation.findUnique({
      where: { id },
    });

    if (!installation) {
      throw new NotFoundException(`Plugin installation with id "${id}" not found`);
    }

    if (installation.status === 'INACTIVE') {
      throw new BadRequestException('Plugin is already inactive');
    }

    return this.prisma.pluginInstallation.update({
      where: { id },
      data: {
        status: 'INACTIVE',
      },
      include: { plugin: true },
    });
  }

  async uninstall(id: string) {
    const installation = await this.prisma.pluginInstallation.findUnique({
      where: { id },
    });

    if (!installation) {
      throw new NotFoundException(`Plugin installation with id "${id}" not found`);
    }

    return this.prisma.pluginInstallation.delete({
      where: { id },
    });
  }

  async findAll(projectId?: string, status?: string) {
    const where: Prisma.PluginInstallationWhereInput = {};

    if (projectId) {
      where.projectId = projectId;
    }

    if (status) {
      where.status = status as Prisma.EnumPluginStatusFilter['equals'];
    }

    const items = await this.prisma.pluginInstallation.findMany({
      where,
      include: { plugin: true },
      orderBy: { installedAt: 'desc' },
    });

    return { items, total: items.length };
  }

  async findById(id: string) {
    const installation = await this.prisma.pluginInstallation.findUnique({
      where: { id },
      include: { plugin: true },
    });

    if (!installation) {
      throw new NotFoundException(`Plugin installation with id "${id}" not found`);
    }

    return installation;
  }

  async updateConfig(id: string, dto: UpdatePluginConfigDto) {
    const installation = await this.prisma.pluginInstallation.findUnique({
      where: { id },
    });

    if (!installation) {
      throw new NotFoundException(`Plugin installation with id "${id}" not found`);
    }

    return this.prisma.pluginInstallation.update({
      where: { id },
      data: {
        config: dto.config as Prisma.InputJsonValue,
      },
      include: { plugin: true },
    });
  }
}
