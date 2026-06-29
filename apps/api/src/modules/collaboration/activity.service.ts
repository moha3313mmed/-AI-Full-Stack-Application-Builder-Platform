import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async track(params: {
    projectId: string;
    userId: string;
    type: string;
    description: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.activity.create({
      data: {
        projectId: params.projectId,
        userId: params.userId,
        type: params.type,
        description: params.description,
        metadata: (params.metadata || {}) as Prisma.InputJsonValue,
      },
    });
  }

  async findByProject(projectId: string, options?: { type?: string; limit?: number; offset?: number }) {
    const where: Record<string, unknown> = { projectId };
    if (options?.type) {
      where.type = options.type;
    }

    const [items, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        take: options?.limit || 50,
        skip: options?.offset || 0,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return { items, total };
  }
}
