import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';

import { MemoryCategoryDto } from './dto/create-memory.dto';
import { MemoryService } from './memory.service';

describe('MemoryService', () => {
  let service: MemoryService;

  const mockPrismaService = {
    projectMemory: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MemoryService>(MemoryService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a memory entry', async () => {
      const dto = {
        category: MemoryCategoryDto.ARCHITECTURE,
        title: 'API Design',
        content: 'We use REST with JSON',
        tags: ['api', 'design'],
        metadata: { version: '1.0' },
      };

      const expected = {
        id: 'mem-1',
        projectId: 'proj-1',
        ...dto,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.projectMemory.create.mockResolvedValue(expected);

      const result = await service.create('proj-1', dto);

      expect(result).toEqual(expected);
      expect(mockPrismaService.projectMemory.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-1',
          category: MemoryCategoryDto.ARCHITECTURE,
          title: 'API Design',
          content: 'We use REST with JSON',
          tags: ['api', 'design'],
          metadata: { version: '1.0' },
        },
      });
    });

    it('should create a memory entry with default tags and metadata', async () => {
      const dto = {
        category: MemoryCategoryDto.DECISIONS,
        title: 'Use PostgreSQL',
        content: 'We decided to use PostgreSQL',
      };

      mockPrismaService.projectMemory.create.mockResolvedValue({
        id: 'mem-2',
        projectId: 'proj-1',
        ...dto,
        tags: [],
        metadata: {},
      });

      await service.create('proj-1', dto);

      expect(mockPrismaService.projectMemory.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-1',
          category: MemoryCategoryDto.DECISIONS,
          title: 'Use PostgreSQL',
          content: 'We decided to use PostgreSQL',
          tags: [],
          metadata: {},
        },
      });
    });
  });

  describe('findById', () => {
    it('should return a memory entry by id', async () => {
      const expected = {
        id: 'mem-1',
        projectId: 'proj-1',
        category: 'ARCHITECTURE',
        title: 'Test',
        content: 'Content',
      };

      mockPrismaService.projectMemory.findUnique.mockResolvedValue(expected);

      const result = await service.findById('mem-1');

      expect(result).toEqual(expected);
      expect(mockPrismaService.projectMemory.findUnique).toHaveBeenCalledWith({
        where: { id: 'mem-1' },
      });
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      mockPrismaService.projectMemory.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('search', () => {
    it('should search with text filter', async () => {
      const items = [
        { id: 'mem-1', title: 'API Design', content: 'REST API' },
      ];

      mockPrismaService.projectMemory.findMany.mockResolvedValue(items);
      mockPrismaService.projectMemory.count.mockResolvedValue(1);

      const result = await service.search('proj-1', {
        searchText: 'API',
      });

      expect(result).toEqual({ items, total: 1 });
      expect(mockPrismaService.projectMemory.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          OR: [
            { title: { contains: 'API', mode: 'insensitive' } },
            { content: { contains: 'API', mode: 'insensitive' } },
          ],
        },
        take: 20,
        skip: 0,
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should search with category filter', async () => {
      mockPrismaService.projectMemory.findMany.mockResolvedValue([]);
      mockPrismaService.projectMemory.count.mockResolvedValue(0);

      await service.search('proj-1', {
        categories: [MemoryCategoryDto.ARCHITECTURE],
      });

      expect(mockPrismaService.projectMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { in: [MemoryCategoryDto.ARCHITECTURE] },
          }),
        }),
      );
    });

    it('should search with tags filter', async () => {
      mockPrismaService.projectMemory.findMany.mockResolvedValue([]);
      mockPrismaService.projectMemory.count.mockResolvedValue(0);

      await service.search('proj-1', {
        tags: ['api', 'rest'],
      });

      expect(mockPrismaService.projectMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tags: { hasSome: ['api', 'rest'] },
          }),
        }),
      );
    });

    it('should respect limit and offset', async () => {
      mockPrismaService.projectMemory.findMany.mockResolvedValue([]);
      mockPrismaService.projectMemory.count.mockResolvedValue(0);

      await service.search('proj-1', { limit: 10, offset: 5 });

      expect(mockPrismaService.projectMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 5,
        }),
      );
    });
  });

  describe('update', () => {
    it('should update a memory entry', async () => {
      const existing = {
        id: 'mem-1',
        title: 'Old Title',
        content: 'Old Content',
      };

      const updated = {
        id: 'mem-1',
        title: 'New Title',
        content: 'Old Content',
        version: 2,
      };

      mockPrismaService.projectMemory.findUnique.mockResolvedValue(existing);
      mockPrismaService.projectMemory.update.mockResolvedValue(updated);

      const result = await service.update('mem-1', { title: 'New Title' });

      expect(result).toEqual(updated);
      expect(mockPrismaService.projectMemory.update).toHaveBeenCalledWith({
        where: { id: 'mem-1' },
        data: {
          title: 'New Title',
          version: { increment: 1 },
        },
      });
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      mockPrismaService.projectMemory.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { title: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a memory entry', async () => {
      const existing = { id: 'mem-1', title: 'Test' };

      mockPrismaService.projectMemory.findUnique.mockResolvedValue(existing);
      mockPrismaService.projectMemory.delete.mockResolvedValue(existing);

      const result = await service.remove('mem-1');

      expect(result).toEqual(existing);
      expect(mockPrismaService.projectMemory.delete).toHaveBeenCalledWith({
        where: { id: 'mem-1' },
      });
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      mockPrismaService.projectMemory.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listByProject', () => {
    it('should list memory entries for a project', async () => {
      const items = [
        { id: 'mem-1', projectId: 'proj-1' },
        { id: 'mem-2', projectId: 'proj-1' },
      ];

      mockPrismaService.projectMemory.findMany.mockResolvedValue(items);
      mockPrismaService.projectMemory.count.mockResolvedValue(2);

      const result = await service.listByProject('proj-1');

      expect(result).toEqual({ items, total: 2 });
      expect(mockPrismaService.projectMemory.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        take: 20,
        skip: 0,
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should respect limit and offset parameters', async () => {
      mockPrismaService.projectMemory.findMany.mockResolvedValue([]);
      mockPrismaService.projectMemory.count.mockResolvedValue(0);

      await service.listByProject('proj-1', 10, 5);

      expect(mockPrismaService.projectMemory.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        take: 10,
        skip: 5,
        orderBy: { updatedAt: 'desc' },
      });
    });
  });

  describe('getByCategory', () => {
    it('should return entries for a specific category', async () => {
      const items = [
        { id: 'mem-1', category: 'ARCHITECTURE' },
        { id: 'mem-2', category: 'ARCHITECTURE' },
      ];

      mockPrismaService.projectMemory.findMany.mockResolvedValue(items);

      const result = await service.getByCategory('proj-1', 'ARCHITECTURE');

      expect(result).toEqual(items);
      expect(mockPrismaService.projectMemory.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1', category: 'ARCHITECTURE' },
        orderBy: { updatedAt: 'desc' },
      });
    });
  });

  describe('getProjectContext', () => {
    it('should aggregate entries from all categories into a context string', async () => {
      mockPrismaService.projectMemory.findMany.mockResolvedValue([
        { title: 'Microservices', content: 'Use microservices architecture', category: 'ARCHITECTURE', updatedAt: new Date('2024-01-02') },
        { title: 'TypeScript', content: 'Use strict TypeScript', category: 'CODING_STANDARDS', updatedAt: new Date('2024-01-01') },
      ]);

      const result = await service.getProjectContext('proj-1');

      expect(result).toContain('# Project Context');
      expect(result).toContain('## ARCHITECTURE');
      expect(result).toContain('- Microservices: Use microservices architecture');
      expect(result).toContain('## CODING STANDARDS');
      expect(result).toContain('- TypeScript: Use strict TypeScript');
      expect(mockPrismaService.projectMemory.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          category: { in: expect.any(Array) },
        },
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should return fallback message when no entries exist', async () => {
      mockPrismaService.projectMemory.findMany.mockResolvedValue([]);

      const result = await service.getProjectContext('proj-1');

      expect(result).toBe('No project context available.');
    });
  });
});
