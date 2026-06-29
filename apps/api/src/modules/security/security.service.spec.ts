import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';

import { TriggerScanDto, SecurityScanTypeDto } from './dto/trigger-scan.dto';
import { SecurityService } from './security.service';

describe('SecurityService', () => {
  let service: SecurityService;

  const mockPrismaService = {
    securityScan: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    securityRule: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SecurityService>(SecurityService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('triggerScan', () => {
    const dto: TriggerScanDto = {
      projectId: 'proj-1',
      scanType: SecurityScanTypeDto.VULNERABILITY,
      triggeredBy: 'user-1',
    };

    it('should create and complete a security scan', async () => {
      const createdScan = {
        id: 'scan-1',
        projectId: 'proj-1',
        scanType: 'VULNERABILITY',
        status: 'PENDING',
      };
      const completedScan = {
        ...createdScan,
        status: 'COMPLETED',
        score: 100,
        findingsCount: 0,
      };

      mockPrismaService.securityScan.create.mockResolvedValue(createdScan);
      mockPrismaService.securityScan.update.mockResolvedValue(completedScan);

      const result = await service.triggerScan(dto);

      expect(result.status).toBe('COMPLETED');
      expect(result.score).toBe(100);
      expect(mockPrismaService.securityScan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          scanType: 'VULNERABILITY',
          status: 'PENDING',
          triggeredBy: 'user-1',
        }),
      });
    });

    it('should use default triggeredBy when not provided', async () => {
      const dtoNoTrigger: TriggerScanDto = {
        projectId: 'proj-1',
        scanType: SecurityScanTypeDto.SECRET_DETECTION,
      };
      const createdScan = { id: 'scan-2', status: 'PENDING' };
      const completedScan = { ...createdScan, status: 'COMPLETED', score: 100 };

      mockPrismaService.securityScan.create.mockResolvedValue(createdScan);
      mockPrismaService.securityScan.update.mockResolvedValue(completedScan);

      await service.triggerScan(dtoNoTrigger);

      expect(mockPrismaService.securityScan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          triggeredBy: 'system',
        }),
      });
    });

    it('should handle different scan types', async () => {
      const xssDto: TriggerScanDto = {
        projectId: 'proj-1',
        scanType: SecurityScanTypeDto.XSS,
      };
      const createdScan = { id: 'scan-3', status: 'PENDING' };
      const completedScan = { ...createdScan, status: 'COMPLETED', score: 100 };

      mockPrismaService.securityScan.create.mockResolvedValue(createdScan);
      mockPrismaService.securityScan.update.mockResolvedValue(completedScan);

      const result = await service.triggerScan(xssDto);

      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('getScansByProject', () => {
    it('should return scans for a project', async () => {
      const items = [
        { id: 'scan-1', projectId: 'proj-1', status: 'COMPLETED' },
        { id: 'scan-2', projectId: 'proj-1', status: 'COMPLETED' },
      ];

      mockPrismaService.securityScan.findMany.mockResolvedValue(items);
      mockPrismaService.securityScan.count.mockResolvedValue(2);

      const result = await service.getScansByProject('proj-1');

      expect(result).toEqual({ items, total: 2 });
      expect(mockPrismaService.securityScan.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        take: 20,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should respect limit and offset', async () => {
      mockPrismaService.securityScan.findMany.mockResolvedValue([]);
      mockPrismaService.securityScan.count.mockResolvedValue(0);

      await service.getScansByProject('proj-1', 5, 10);

      expect(mockPrismaService.securityScan.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        take: 5,
        skip: 10,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getScanById', () => {
    it('should return a scan by id and project', async () => {
      const scan = {
        id: 'scan-1',
        projectId: 'proj-1',
        status: 'COMPLETED',
        score: 85,
      };

      mockPrismaService.securityScan.findFirst.mockResolvedValue(scan);

      const result = await service.getScanById('proj-1', 'scan-1');

      expect(result).toEqual(scan);
      expect(mockPrismaService.securityScan.findFirst).toHaveBeenCalledWith({
        where: { id: 'scan-1', projectId: 'proj-1' },
      });
    });

    it('should throw NotFoundException when scan does not exist', async () => {
      mockPrismaService.securityScan.findFirst.mockResolvedValue(null);

      await expect(service.getScanById('proj-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSecurityScore', () => {
    it('should calculate overall security score from completed scans', async () => {
      const scans = [
        { id: 'scan-1', score: 90, findingsCount: 2, completedAt: new Date() },
        { id: 'scan-2', score: 80, findingsCount: 5, completedAt: new Date() },
      ];

      mockPrismaService.securityScan.findMany.mockResolvedValue(scans);

      const result = await service.getSecurityScore('proj-1');

      expect(result.overallScore).toBe(85);
      expect(result.scansCompleted).toBe(2);
      expect(result.totalFindings).toBe(7);
    });

    it('should return null score when no completed scans exist', async () => {
      mockPrismaService.securityScan.findMany.mockResolvedValue([]);

      const result = await service.getSecurityScore('proj-1');

      expect(result.overallScore).toBeNull();
      expect(result.scansCompleted).toBe(0);
    });

    it('should handle scans with null scores', async () => {
      const scans = [
        { id: 'scan-1', score: null, findingsCount: 0, completedAt: new Date() },
        { id: 'scan-2', score: 75, findingsCount: 3, completedAt: new Date() },
      ];

      mockPrismaService.securityScan.findMany.mockResolvedValue(scans);

      const result = await service.getSecurityScore('proj-1');

      expect(result.overallScore).toBe(75);
      expect(result.scansCompleted).toBe(2);
    });
  });

  describe('getRules', () => {
    it('should return security rules', async () => {
      const items = [
        { id: 'rule-1', name: 'No eval', enabled: true },
        { id: 'rule-2', name: 'No innerHTML', enabled: true },
      ];

      mockPrismaService.securityRule.findMany.mockResolvedValue(items);
      mockPrismaService.securityRule.count.mockResolvedValue(2);

      const result = await service.getRules();

      expect(result).toEqual({ items, total: 2 });
    });

    it('should respect limit and offset', async () => {
      mockPrismaService.securityRule.findMany.mockResolvedValue([]);
      mockPrismaService.securityRule.count.mockResolvedValue(0);

      await service.getRules(10, 5);

      expect(mockPrismaService.securityRule.findMany).toHaveBeenCalledWith({
        take: 10,
        skip: 5,
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('updateRule', () => {
    it('should update rule enabled status', async () => {
      const rule = { id: 'rule-1', name: 'No eval', enabled: true };
      const updated = { ...rule, enabled: false };

      mockPrismaService.securityRule.findUnique.mockResolvedValue(rule);
      mockPrismaService.securityRule.update.mockResolvedValue(updated);

      const result = await service.updateRule('rule-1', { enabled: false });

      expect(result.enabled).toBe(false);
    });

    it('should update rule config', async () => {
      const rule = { id: 'rule-1', name: 'No eval', config: {} };
      const updated = { ...rule, config: { threshold: 5 } };

      mockPrismaService.securityRule.findUnique.mockResolvedValue(rule);
      mockPrismaService.securityRule.update.mockResolvedValue(updated);

      const result = await service.updateRule('rule-1', { config: { threshold: 5 } });

      expect(result.config).toEqual({ threshold: 5 });
    });

    it('should throw NotFoundException when rule does not exist', async () => {
      mockPrismaService.securityRule.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRule('non-existent', { enabled: false }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
