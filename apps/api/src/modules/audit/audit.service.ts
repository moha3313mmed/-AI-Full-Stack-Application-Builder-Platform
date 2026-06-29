import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export interface LogActionParams {
  userId?: string;
  organizationId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logAction(params: LogActionParams) {
    return this.prisma.auditLog.create({
      data: {
        userId: params.userId,
        organizationId: params.organizationId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        metadata:
          (params.metadata as Prisma.InputJsonValue) ||
          Prisma.JsonNull,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }

  async getAuditLogs(filters: {
    userId?: string;
    organizationId?: string;
    action?: string;
    resource?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.organizationId)
      where.organizationId = filters.organizationId;
    if (filters.action) where.action = filters.action;
    if (filters.resource) where.resource = filters.resource;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        take: filters.limit || 50,
        skip: filters.offset || 0,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}
