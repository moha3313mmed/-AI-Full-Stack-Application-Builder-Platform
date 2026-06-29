import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';

import { ApiKeysService } from './api-keys.service';

describe('ApiKeysService', () => {
  let service: ApiKeysService;

  const mockPrismaService = {
    apiKey: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ApiKeysService>(ApiKeysService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an API key and return it with the raw key', async () => {
      const dto = { name: 'My Key', scopes: ['read', 'write'] };
      const mockCreatedKey = {
        id: 'key-1',
        name: 'My Key',
        prefix: 'bld_abcd',
        scopes: ['read', 'write'],
        expiresAt: null,
        createdAt: new Date(),
      };

      mockPrismaService.apiKey.create.mockResolvedValue(mockCreatedKey);

      const result = await service.create('user-1', dto);

      expect(result.id).toBe('key-1');
      expect(result.name).toBe('My Key');
      expect(result.key).toMatch(/^bld_/);
      expect(result.key.length).toBeGreaterThan(8);
      expect(result.prefix).toBeDefined();
      expect(result.scopes).toEqual(['read', 'write']);
      expect(mockPrismaService.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          name: 'My Key',
          scopes: ['read', 'write'],
        }),
      });
    });

    it('should create key with empty scopes by default', async () => {
      const dto = { name: 'Basic Key' };
      const mockCreatedKey = {
        id: 'key-2',
        name: 'Basic Key',
        prefix: 'bld_efgh',
        scopes: [],
        expiresAt: null,
        createdAt: new Date(),
      };

      mockPrismaService.apiKey.create.mockResolvedValue(mockCreatedKey);

      await service.create('user-1', dto);

      expect(mockPrismaService.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scopes: [],
        }),
      });
    });

    it('should create key with expiration date', async () => {
      const expiresAt = '2025-12-31T00:00:00Z';
      const dto = { name: 'Expiring Key', expiresAt };
      const mockCreatedKey = {
        id: 'key-3',
        name: 'Expiring Key',
        prefix: 'bld_ijkl',
        scopes: [],
        expiresAt: new Date(expiresAt),
        createdAt: new Date(),
      };

      mockPrismaService.apiKey.create.mockResolvedValue(mockCreatedKey);

      const result = await service.create('user-1', dto);

      expect(result.expiresAt).toEqual(new Date(expiresAt));
      expect(mockPrismaService.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: new Date(expiresAt),
        }),
      });
    });
  });

  describe('findAllByUser', () => {
    it('should return non-revoked keys for a user', async () => {
      const keys = [
        { id: 'key-1', name: 'Key 1', prefix: 'bld_abcd', scopes: [], lastUsedAt: null, expiresAt: null, createdAt: new Date() },
        { id: 'key-2', name: 'Key 2', prefix: 'bld_efgh', scopes: ['read'], lastUsedAt: new Date(), expiresAt: null, createdAt: new Date() },
      ];

      mockPrismaService.apiKey.findMany.mockResolvedValue(keys);

      const result = await service.findAllByUser('user-1');

      expect(result).toEqual(keys);
      expect(mockPrismaService.apiKey.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          revokedAt: null,
        },
        select: {
          id: true,
          name: true,
          prefix: true,
          scopes: true,
          lastUsedAt: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('revoke', () => {
    it('should revoke an existing API key', async () => {
      const existingKey = {
        id: 'key-1',
        userId: 'user-1',
        revokedAt: null,
      };

      mockPrismaService.apiKey.findFirst.mockResolvedValue(existingKey);
      mockPrismaService.apiKey.update.mockResolvedValue({
        ...existingKey,
        revokedAt: new Date(),
      });

      const result = await service.revoke('user-1', 'key-1');

      expect(result.revokedAt).toBeDefined();
      expect(mockPrismaService.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw NotFoundException when key does not exist', async () => {
      mockPrismaService.apiKey.findFirst.mockResolvedValue(null);

      await expect(service.revoke('user-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when key belongs to another user', async () => {
      mockPrismaService.apiKey.findFirst.mockResolvedValue(null);

      await expect(service.revoke('user-2', 'key-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('validateKey', () => {
    it('should return user info for a valid key', async () => {
      const rawKey = 'bld_' + 'a'.repeat(64);
      const existingKey = {
        id: 'key-1',
        userId: 'user-1',
        prefix: 'bld_aaaa',
        scopes: ['read'],
        expiresAt: null,
        revokedAt: null,
      };

      mockPrismaService.apiKey.findFirst.mockResolvedValue(existingKey);
      mockPrismaService.apiKey.update.mockResolvedValue(existingKey);

      const result = await service.validateKey(rawKey);

      expect(result).toEqual({
        userId: 'user-1',
        scopes: ['read'],
      });
    });

    it('should return null for unknown key', async () => {
      mockPrismaService.apiKey.findFirst.mockResolvedValue(null);

      const result = await service.validateKey('bld_unknown');

      expect(result).toBeNull();
    });

    it('should return null for expired key', async () => {
      const rawKey = 'bld_' + 'b'.repeat(64);
      const existingKey = {
        id: 'key-2',
        userId: 'user-1',
        prefix: 'bld_bbbb',
        scopes: ['read'],
        expiresAt: new Date('2020-01-01'), // expired
        revokedAt: null,
      };

      mockPrismaService.apiKey.findFirst.mockResolvedValue(existingKey);

      const result = await service.validateKey(rawKey);

      expect(result).toBeNull();
    });

    it('should update lastUsedAt on successful validation', async () => {
      const rawKey = 'bld_' + 'c'.repeat(64);
      const existingKey = {
        id: 'key-3',
        userId: 'user-1',
        prefix: 'bld_cccc',
        scopes: [],
        expiresAt: null,
        revokedAt: null,
      };

      mockPrismaService.apiKey.findFirst.mockResolvedValue(existingKey);
      mockPrismaService.apiKey.update.mockResolvedValue(existingKey);

      await service.validateKey(rawKey);

      expect(mockPrismaService.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-3' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });
  });
});
