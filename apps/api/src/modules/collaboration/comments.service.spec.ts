import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';

import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  let service: CommentsService;

  const mockPrismaService = {
    comment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a comment', async () => {
      const dto = { content: 'Great code!', filePath: 'src/index.ts', lineNumber: 10 };
      const expected = {
        id: 'comment-1',
        projectId: 'proj-1',
        authorId: 'user-1',
        ...dto,
        threadId: null,
        resolvedAt: null,
        createdAt: new Date(),
      };

      mockPrismaService.comment.create.mockResolvedValue(expected);

      const result = await service.create('proj-1', 'user-1', dto);

      expect(result).toEqual(expected);
      expect(mockPrismaService.comment.create).toHaveBeenCalledWith({
        data: {
          projectId: 'proj-1',
          authorId: 'user-1',
          content: 'Great code!',
          filePath: 'src/index.ts',
          lineNumber: 10,
          threadId: undefined,
        },
      });
    });

    it('should create a comment with thread reference', async () => {
      const dto = { content: 'Reply', threadId: 'comment-parent' };
      const expected = {
        id: 'comment-2',
        projectId: 'proj-1',
        authorId: 'user-2',
        content: 'Reply',
        threadId: 'comment-parent',
        createdAt: new Date(),
      };

      mockPrismaService.comment.create.mockResolvedValue(expected);

      const result = await service.create('proj-1', 'user-2', dto);

      expect(result.threadId).toBe('comment-parent');
    });

    it('should create a comment without optional fields', async () => {
      const dto = { content: 'Simple comment' };
      const expected = {
        id: 'comment-3',
        projectId: 'proj-1',
        authorId: 'user-1',
        content: 'Simple comment',
        filePath: null,
        lineNumber: null,
        threadId: null,
        createdAt: new Date(),
      };

      mockPrismaService.comment.create.mockResolvedValue(expected);

      const result = await service.create('proj-1', 'user-1', dto);
      expect(result.filePath).toBeNull();
      expect(result.lineNumber).toBeNull();
    });
  });

  describe('findByProject', () => {
    it('should list comments for a project', async () => {
      const comments = [
        { id: 'comment-1', content: 'Comment 1', author: { id: 'user-1', name: 'Alice', email: 'alice@test.com' } },
        { id: 'comment-2', content: 'Comment 2', author: { id: 'user-2', name: 'Bob', email: 'bob@test.com' } },
      ];

      mockPrismaService.comment.findMany.mockResolvedValue(comments);

      const result = await service.findByProject('proj-1');

      expect(result).toHaveLength(2);
      expect(mockPrismaService.comment.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1' },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { id: true, name: true, email: true } } },
      });
    });

    it('should filter comments by file path', async () => {
      mockPrismaService.comment.findMany.mockResolvedValue([]);

      await service.findByProject('proj-1', 'src/app.ts');

      expect(mockPrismaService.comment.findMany).toHaveBeenCalledWith({
        where: { projectId: 'proj-1', filePath: 'src/app.ts' },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { id: true, name: true, email: true } } },
      });
    });
  });

  describe('resolve', () => {
    it('should resolve a comment', async () => {
      const existing = { id: 'comment-1', resolvedAt: null };
      const resolved = { ...existing, resolvedAt: new Date() };

      mockPrismaService.comment.findUnique.mockResolvedValue(existing);
      mockPrismaService.comment.update.mockResolvedValue(resolved);

      const result = await service.resolve('comment-1');

      expect(result.resolvedAt).toBeInstanceOf(Date);
      expect(mockPrismaService.comment.update).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        data: { resolvedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(null);

      await expect(service.resolve('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('should return a comment with replies', async () => {
      const expected = {
        id: 'comment-1',
        content: 'Parent',
        replies: [{ id: 'comment-2', content: 'Reply' }],
      };

      mockPrismaService.comment.findUnique.mockResolvedValue(expected);

      const result = await service.findById('comment-1');
      expect(result.replies).toHaveLength(1);
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a comment content', async () => {
      const existing = { id: 'comment-1', content: 'Old content', projectId: 'proj-1' };
      const updated = { ...existing, content: 'Updated content' };

      mockPrismaService.comment.findUnique.mockResolvedValue(existing);
      mockPrismaService.comment.update.mockResolvedValue(updated);

      const result = await service.update('comment-1', { content: 'Updated content' });

      expect(result.content).toBe('Updated content');
      expect(mockPrismaService.comment.update).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
        data: { content: 'Updated content' },
      });
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { content: 'New content' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete a comment', async () => {
      const existing = { id: 'comment-1', content: 'To delete', projectId: 'proj-1' };

      mockPrismaService.comment.findUnique.mockResolvedValue(existing);
      mockPrismaService.comment.delete.mockResolvedValue(existing);

      const result = await service.delete('comment-1');

      expect(result).toEqual(existing);
      expect(mockPrismaService.comment.delete).toHaveBeenCalledWith({
        where: { id: 'comment-1' },
      });
    });

    it('should throw NotFoundException when comment does not exist', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
