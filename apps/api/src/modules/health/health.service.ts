import { HealthChecker } from '@builder/monitoring';
import type { HealthResult } from '@builder/monitoring';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
  details?: HealthResult;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly healthChecker: HealthChecker;

  constructor(private readonly prisma: PrismaService) {
    this.healthChecker = new HealthChecker();
    this.registerChecks();
  }

  private registerChecks(): void {
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

    this.healthChecker.registerCheck('redis', async () => {
      // Known limitation: No real Redis connection is available in the dev environment.
      // When a Redis client (e.g., via AppCacheService) is configured and injected,
      // this check should perform an actual PING to report live connectivity status.
      return { status: 'down', error: 'Redis client not configured' };
    });
  }

  async check(): Promise<HealthStatus> {
    const healthResult = await this.healthChecker.runAll();

    const dbCheck = healthResult.checks.find((c) => c.name === 'database');
    const redisCheck = healthResult.checks.find((c) => c.name === 'redis');

    const dbStatus: 'up' | 'down' = dbCheck?.status === 'up' ? 'up' : 'down';
    const redisStatus: 'up' | 'down' = redisCheck?.status === 'up' ? 'up' : 'down';

    const overallStatus =
      dbStatus === 'up' && redisStatus === 'up'
        ? 'ok'
        : dbStatus === 'down' && redisStatus === 'down'
          ? 'down'
          : 'degraded';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
      details: healthResult,
    };
  }
}
