import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';

import { AdminService } from './admin.service';

jest.mock('@builder/monitoring', () => ({
  HealthChecker: jest.fn().mockImplementation(() => ({
    registerCheck: jest.fn(),
    runAll: jest.fn().mockResolvedValue({
      status: 'healthy',
      checks: [{ name: 'database', status: 'up', latency: 5 }],
      timestamp: new Date().toISOString(),
    }),
  })),
  MetricsCollector: jest.fn().mockImplementation(() => ({
    gauge: jest.fn(),
    increment: jest.fn(),
    getMetrics: jest.fn().mockReturnValue(
      '# HELP platform_users_total Gauge metric\n# TYPE platform_users_total gauge\nplatform_users_total 10',
    ),
    resetMetrics: jest.fn(),
  })),
}));

describe('AdminService', () => {
  let service: AdminService;

  const mockPrismaService = {
    user: {
      count: jest.fn().mockResolvedValue(100),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    project: {
      count: jest.fn().mockResolvedValue(50),
    },
    deployment: {
      count: jest.fn().mockResolvedValue(25),
    },
    subscription: {
      count: jest.fn().mockResolvedValue(30),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStats', () => {
    it('should return platform statistics', async () => {
      const stats = await service.getStats();

      expect(stats).toEqual({
        users: 100,
        projects: 50,
        deployments: 25,
        activeSubscriptions: 30,
      });
    });

    it('should query user count', async () => {
      await service.getStats();
      expect(mockPrismaService.user.count).toHaveBeenCalled();
    });

    it('should query project count', async () => {
      await service.getStats();
      expect(mockPrismaService.project.count).toHaveBeenCalled();
    });

    it('should query deployment count', async () => {
      await service.getStats();
      expect(mockPrismaService.deployment.count).toHaveBeenCalled();
    });

    it('should query active subscription count', async () => {
      await service.getStats();
      expect(mockPrismaService.subscription.count).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
      });
    });
  });

  describe('getUsers', () => {
    it('should return paginated users', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([
        { id: '1', email: 'user@test.com', name: 'Test', role: 'USER', createdAt: new Date() },
      ]);
      mockPrismaService.user.count.mockResolvedValue(1);

      const result = await service.getUsers(1, 20);

      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should apply search filter', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.getUsers(1, 20, 'test@');

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { email: { contains: 'test@', mode: 'insensitive' } },
              { name: { contains: 'test@', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('should calculate correct pagination', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(45);

      const result = await service.getUsers(2, 20);

      expect(result.totalPages).toBe(3);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        }),
      );
    });
  });

  describe('updateUserRole', () => {
    it('should update user role and return updated user', async () => {
      const updatedUser = {
        id: 'user-1',
        email: 'admin@test.com',
        name: 'Admin',
        role: 'ADMIN',
        createdAt: new Date(),
      };
      mockPrismaService.user.findUnique.mockResolvedValue({ role: 'USER' });
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateUserRole('user-1', 'ADMIN');

      expect(result).toEqual(updatedUser);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: 'ADMIN' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });
    });

    it('should allow demoting SUPER_ADMIN when multiple super admins exist', async () => {
      const updatedUser = {
        id: 'user-1',
        email: 'admin@test.com',
        name: 'Admin',
        role: 'ADMIN',
        createdAt: new Date(),
      };
      mockPrismaService.user.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN' });
      mockPrismaService.user.count.mockResolvedValue(2);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateUserRole('user-1', 'ADMIN');

      expect(result).toEqual(updatedUser);
    });

    it('should prevent demoting the last SUPER_ADMIN', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN' });
      mockPrismaService.user.count.mockResolvedValue(1);

      await expect(service.updateUserRole('user-1', 'ADMIN')).rejects.toThrow(
        'Cannot remove SUPER_ADMIN role from the last super administrator',
      );

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it('should prevent demoting the last SUPER_ADMIN to USER', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN' });
      mockPrismaService.user.count.mockResolvedValue(1);

      await expect(service.updateUserRole('user-1', 'USER')).rejects.toThrow(
        'Cannot remove SUPER_ADMIN role from the last super administrator',
      );
    });

    it('should allow keeping SUPER_ADMIN role on the last super admin', async () => {
      const updatedUser = {
        id: 'user-1',
        email: 'super@test.com',
        name: 'Super',
        role: 'SUPER_ADMIN',
        createdAt: new Date(),
      };
      mockPrismaService.user.findUnique.mockResolvedValue({ role: 'SUPER_ADMIN' });
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateUserRole('user-1', 'SUPER_ADMIN');

      expect(result).toEqual(updatedUser);
      // Should not check count when role stays the same
      expect(mockPrismaService.user.count).not.toHaveBeenCalledWith({
        where: { role: 'SUPER_ADMIN' },
      });
    });
  });

  describe('getDetailedHealth', () => {
    it('should return health check results', async () => {
      const health = await service.getDetailedHealth();

      expect(health.status).toBe('healthy');
      expect(health.checks).toBeDefined();
      expect(health.timestamp).toBeDefined();
    });
  });

  describe('getMetrics', () => {
    it('should return Prometheus format metrics', () => {
      const metrics = service.getMetrics();

      expect(metrics).toContain('platform_users_total');
    });
  });
});
