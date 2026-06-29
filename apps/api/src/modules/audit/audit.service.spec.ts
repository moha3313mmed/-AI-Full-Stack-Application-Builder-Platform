import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';

import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;

  const mockPrismaService = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logAction', () => {
    it('should create an audit log entry', async () => {
      const logEntry = {
        id: 'log-1',
        userId: 'user-1',
        action: 'CREATE',
        resource: 'projects',
        resourceId: 'proj-1',
        metadata: {},
        createdAt: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue(logEntry);

      const result = await service.logAction({
        userId: 'user-1',
        action: 'CREATE',
        resource: 'projects',
        resourceId: 'proj-1',
      });

      expect(result).toEqual(logEntry);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          organizationId: undefined,
          action: 'CREATE',
          resource: 'projects',
          resourceId: 'proj-1',
          metadata: {},
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
    });

    it('should log with all optional fields', async () => {
      const logEntry = {
        id: 'log-2',
        userId: 'user-1',
        organizationId: 'org-1',
        action: 'DELETE',
        resource: 'api-keys',
        resourceId: 'key-1',
        metadata: { reason: 'expired' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date(),
      };

      mockPrismaService.auditLog.create.mockResolvedValue(logEntry);

      const result = await service.logAction({
        userId: 'user-1',
        organizationId: 'org-1',
        action: 'DELETE',
        resource: 'api-keys',
        resourceId: 'key-1',
        metadata: { reason: 'expired' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(result).toEqual(logEntry);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          organizationId: 'org-1',
          action: 'DELETE',
          resource: 'api-keys',
          resourceId: 'key-1',
          metadata: { reason: 'expired' },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      });
    });

    it('should handle missing metadata gracefully', async () => {
      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'log-3',
        action: 'UPDATE',
        resource: 'settings',
        metadata: {},
      });

      await service.logAction({
        action: 'UPDATE',
        resource: 'settings',
      });

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: {},
        }),
      });
    });
  });

  describe('getAuditLogs', () => {
    it('should return audit logs with pagination', async () => {
      const items = [
        { id: 'log-1', action: 'CREATE', resource: 'projects' },
        { id: 'log-2', action: 'UPDATE', resource: 'projects' },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(items);
      mockPrismaService.auditLog.count.mockResolvedValue(2);

      const result = await service.getAuditLogs({});

      expect(result).toEqual({ items, total: 2 });
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by userId', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      await service.getAuditLogs({ userId: 'user-1' });

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by action and resource', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      await service.getAuditLogs({
        action: 'DELETE',
        resource: 'api-keys',
      });

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: { action: 'DELETE', resource: 'api-keys' },
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should respect custom limit and offset', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      await service.getAuditLogs({ limit: 10, offset: 20 });

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        take: 10,
        skip: 20,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by organizationId', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      await service.getAuditLogs({ organizationId: 'org-1' });

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
