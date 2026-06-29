import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';

import { FilePersistenceService } from './file-persistence.service';
import { StorageService } from './storage.service';

describe('FilePersistenceService', () => {
  let service: FilePersistenceService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let storageService: jest.Mocked<StorageService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let prismaService: any;

  const mockStorageService = {
    available: true,
    uploadFile: jest.fn(),
    downloadFile: jest.fn(),
    deleteFile: jest.fn(),
    listProjectFiles: jest.fn(),
  };

  const mockPrismaService = {
    projectFile: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilePersistenceService,
        { provide: StorageService, useValue: mockStorageService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<FilePersistenceService>(FilePersistenceService);
    storageService = module.get(StorageService) as jest.Mocked<StorageService>;
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('available', () => {
    it('should return true when storage is available', () => {
      expect(service.available).toBe(true);
    });

    it('should return false when storage is not available', () => {
      Object.defineProperty(mockStorageService, 'available', { value: false, writable: true });
      expect(service.available).toBe(false);
      Object.defineProperty(mockStorageService, 'available', { value: true, writable: true });
    });
  });

  describe('persistFile', () => {
    it('should upload to S3 and upsert DB record', async () => {
      mockStorageService.uploadFile.mockResolvedValue('projects/proj-1/src/index.ts');
      mockPrismaService.projectFile.upsert.mockResolvedValue({});

      await service.persistFile('proj-1', '/src/index.ts', 'const x = 1;', 'typescript');

      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(
        'proj-1',
        '/src/index.ts',
        'const x = 1;',
      );
      expect(mockPrismaService.projectFile.upsert).toHaveBeenCalledWith({
        where: {
          projectId_path: { projectId: 'proj-1', path: '/src/index.ts' },
        },
        create: expect.objectContaining({
          projectId: 'proj-1',
          path: '/src/index.ts',
          language: 'typescript',
          s3Key: 'projects/proj-1/src/index.ts',
        }),
        update: expect.objectContaining({
          language: 'typescript',
          s3Key: 'projects/proj-1/src/index.ts',
        }),
      });
    });

    it('should skip when storage is not available', async () => {
      Object.defineProperty(mockStorageService, 'available', { value: false, writable: true });

      await service.persistFile('proj-1', '/src/index.ts', 'content');

      expect(mockStorageService.uploadFile).not.toHaveBeenCalled();
      Object.defineProperty(mockStorageService, 'available', { value: true, writable: true });
    });

    it('should handle errors gracefully', async () => {
      mockStorageService.uploadFile.mockRejectedValue(new Error('Upload failed'));

      // Should not throw
      await expect(
        service.persistFile('proj-1', '/src/index.ts', 'content'),
      ).resolves.toBeUndefined();
    });
  });

  describe('deletePersistedFile', () => {
    it('should delete from S3 and DB when record exists', async () => {
      const record = { id: 'file-1', s3Key: 'projects/proj-1/src/old.ts' };
      mockPrismaService.projectFile.findUnique.mockResolvedValue(record);
      mockStorageService.deleteFile.mockResolvedValue(undefined);
      mockPrismaService.projectFile.delete.mockResolvedValue({});

      await service.deletePersistedFile('proj-1', '/src/old.ts');

      expect(mockStorageService.deleteFile).toHaveBeenCalledWith('projects/proj-1/src/old.ts');
      expect(mockPrismaService.projectFile.delete).toHaveBeenCalledWith({
        where: { id: 'file-1' },
      });
    });

    it('should do nothing when record does not exist', async () => {
      mockPrismaService.projectFile.findUnique.mockResolvedValue(null);

      await service.deletePersistedFile('proj-1', '/nonexistent.ts');

      expect(mockStorageService.deleteFile).not.toHaveBeenCalled();
      expect(mockPrismaService.projectFile.delete).not.toHaveBeenCalled();
    });

    it('should skip when storage is not available', async () => {
      Object.defineProperty(mockStorageService, 'available', { value: false, writable: true });

      await service.deletePersistedFile('proj-1', '/src/index.ts');

      expect(mockPrismaService.projectFile.findUnique).not.toHaveBeenCalled();
      Object.defineProperty(mockStorageService, 'available', { value: true, writable: true });
    });

    it('should handle errors gracefully', async () => {
      mockPrismaService.projectFile.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(
        service.deletePersistedFile('proj-1', '/src/index.ts'),
      ).resolves.toBeUndefined();
    });
  });

  describe('loadProjectFiles', () => {
    it('should load file metadata from DB and content from S3', async () => {
      mockPrismaService.projectFile.findMany.mockResolvedValue([
        { path: '/src/a.ts', s3Key: 'projects/proj-1/src/a.ts', language: 'typescript', size: 10 },
        { path: '/src/b.ts', s3Key: 'projects/proj-1/src/b.ts', language: 'typescript', size: 20 },
      ]);
      mockStorageService.downloadFile
        .mockResolvedValueOnce('content A')
        .mockResolvedValueOnce('content B');

      const files = await service.loadProjectFiles('proj-1');

      expect(files).toHaveLength(2);
      expect(files[0]).toEqual({
        path: '/src/a.ts',
        content: 'content A',
        language: 'typescript',
        size: 10,
      });
      expect(files[1]).toEqual({
        path: '/src/b.ts',
        content: 'content B',
        language: 'typescript',
        size: 20,
      });
    });

    it('should return empty array when storage is not available', async () => {
      Object.defineProperty(mockStorageService, 'available', { value: false, writable: true });

      const files = await service.loadProjectFiles('proj-1');

      expect(files).toEqual([]);
      Object.defineProperty(mockStorageService, 'available', { value: true, writable: true });
    });

    it('should skip files that fail to download', async () => {
      mockPrismaService.projectFile.findMany.mockResolvedValue([
        { path: '/src/a.ts', s3Key: 'key-a', language: 'typescript', size: 10 },
        { path: '/src/b.ts', s3Key: 'key-b', language: 'typescript', size: 20 },
      ]);
      mockStorageService.downloadFile
        .mockRejectedValueOnce(new Error('Download failed'))
        .mockResolvedValueOnce('content B');

      const files = await service.loadProjectFiles('proj-1');

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('/src/b.ts');
    });

    it('should handle DB errors gracefully', async () => {
      mockPrismaService.projectFile.findMany.mockRejectedValue(new Error('DB error'));

      const files = await service.loadProjectFiles('proj-1');
      expect(files).toEqual([]);
    });
  });

  describe('hasPersistedFiles', () => {
    it('should return true when files exist', async () => {
      mockPrismaService.projectFile.count.mockResolvedValue(5);
      const result = await service.hasPersistedFiles('proj-1');
      expect(result).toBe(true);
    });

    it('should return false when no files exist', async () => {
      mockPrismaService.projectFile.count.mockResolvedValue(0);
      const result = await service.hasPersistedFiles('proj-1');
      expect(result).toBe(false);
    });

    it('should return false when storage is not available', async () => {
      Object.defineProperty(mockStorageService, 'available', { value: false, writable: true });
      const result = await service.hasPersistedFiles('proj-1');
      expect(result).toBe(false);
      Object.defineProperty(mockStorageService, 'available', { value: true, writable: true });
    });
  });
});
