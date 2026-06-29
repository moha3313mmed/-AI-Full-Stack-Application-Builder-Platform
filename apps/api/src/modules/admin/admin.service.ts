import { HealthChecker, MetricsCollector } from '@builder/monitoring';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import type { PlatformStats, PaginatedUsers } from './admin.types';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly healthChecker: HealthChecker;
  private readonly metricsCollector: MetricsCollector;

  constructor(private readonly prisma: PrismaService) {
    this.healthChecker = new HealthChecker();
    this.metricsCollector = new MetricsCollector();

    this.registerHealthChecks();
  }

  private registerHealthChecks(): void {
    this.healthChecker.registerCheck('database', async () => {
      try {
        const start = Date.now();
        await this.prisma.$queryRaw`SELECT 1`;
        return { status: 'up', latency: Date.now() - start };
      } catch (error) {
        return {
          status: 'down',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  async getStats(): Promise<PlatformStats> {
    const [users, projects, deployments, activeSubscriptions] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.project.count(),
      this.prisma.deployment.count(),
      this.prisma.subscription.count({
        where: { status: 'ACTIVE' },
      }),
    ]);

    this.metricsCollector.gauge('platform_users_total', users);
    this.metricsCollector.gauge('platform_projects_total', projects);
    this.metricsCollector.gauge('platform_deployments_total', deployments);
    this.metricsCollector.gauge('platform_subscriptions_active', activeSubscriptions);

    return { users, projects, deployments, activeSubscriptions };
  }

  async getUsers(page: number, limit: number, search?: string): Promise<PaginatedUsers> {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateUserRole(userId: string, role: 'USER' | 'ADMIN' | 'SUPER_ADMIN') {
    // Prevent removing SUPER_ADMIN role if this is the last super admin
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (currentUser?.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
      const superAdminCount = await this.prisma.user.count({
        where: { role: 'SUPER_ADMIN' },
      });

      if (superAdminCount <= 1) {
        throw new BadRequestException(
          'Cannot remove SUPER_ADMIN role from the last super administrator. ' +
          'At least one super administrator must exist at all times.',
        );
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    this.logger.log(`User ${userId} role updated to ${role}`);
    return user;
  }

  async getDetailedHealth() {
    return this.healthChecker.runAll();
  }

  getMetrics(): string {
    return this.metricsCollector.getMetrics();
  }
}
