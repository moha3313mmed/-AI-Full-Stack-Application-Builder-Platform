import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { StorageService } from './storage.service';

// Mock @aws-sdk/client-s3
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'PutObject' })),
    GetObjectCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'GetObject' })),
    DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'DeleteObject' })),
    ListObjectsV2Command: jest.fn().mockImplementation((input) => ({ ...input, _type: 'ListObjectsV2' })),
    CreateBucketCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'CreateBucket' })),
    HeadBucketCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'HeadBucket' })),
  };
});

describe('StorageService', () => {
  let service: StorageService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        MINIO_ENDPOINT: 'localhost',
        MINIO_PORT: '9000',
        MINIO_ACCESS_KEY: 'minioadmin',
        MINIO_SECRET_KEY: 'minioadmin',
        MINIO_BUCKET: 'test-bucket',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize S3 client and check bucket exists', async () => {
      mockSend.mockResolvedValueOnce({}); // HeadBucket succeeds
      await service.onModuleInit();
      expect(service.available).toBe(true);
    });

    it('should create bucket if it does not exist', async () => {
      mockSend
        .mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } }) // HeadBucket 404
        .mockResolvedValueOnce({}); // CreateBucket succeeds
      await service.onModuleInit();
      expect(service.available).toBe(true);
    });

    it('should operate in memory-only mode when config is missing', async () => {
      const noConfigService = {
        get: jest.fn(() => undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          { provide: ConfigService, useValue: noConfigService },
        ],
      }).compile();

      const svc = module.get<StorageService>(StorageService);
      await svc.onModuleInit();
      expect(svc.available).toBe(false);
    });

    it('should fall back to memory-only when connection fails', async () => {
      mockSend.mockRejectedValueOnce(new Error('Connection refused'));
      await service.onModuleInit();
      expect(service.available).toBe(false);
    });
  });

  describe('uploadFile', () => {
    beforeEach(async () => {
      mockSend.mockResolvedValueOnce({}); // HeadBucket
      await service.onModuleInit();
    });

    it('should upload file and return S3 key', async () => {
      mockSend.mockResolvedValueOnce({});

      const key = await service.uploadFile('proj-1', '/src/index.ts', 'const x = 1;');
      expect(key).toBe('projects/proj-1/src/index.ts');
      expect(mockSend).toHaveBeenCalledTimes(2); // HeadBucket + PutObject
    });

    it('should throw if storage is not available', async () => {
      const noConfigService = {
        get: jest.fn(() => undefined),
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          { provide: ConfigService, useValue: noConfigService },
        ],
      }).compile();
      const svc = module.get<StorageService>(StorageService);
      await svc.onModuleInit();

      await expect(svc.uploadFile('p', '/f', 'c')).rejects.toThrow(
        'Storage service is not available',
      );
    });
  });

  describe('downloadFile', () => {
    beforeEach(async () => {
      mockSend.mockResolvedValueOnce({}); // HeadBucket
      await service.onModuleInit();
    });

    it('should download and return file content', async () => {
      mockSend.mockResolvedValueOnce({
        Body: { transformToString: jest.fn().mockResolvedValue('file content') },
      });

      const content = await service.downloadFile('projects/proj-1/src/index.ts');
      expect(content).toBe('file content');
    });

    it('should return empty string if body is empty', async () => {
      mockSend.mockResolvedValueOnce({ Body: null });

      const content = await service.downloadFile('some-key');
      expect(content).toBe('');
    });
  });

  describe('deleteFile', () => {
    beforeEach(async () => {
      mockSend.mockResolvedValueOnce({}); // HeadBucket
      await service.onModuleInit();
    });

    it('should delete file from S3', async () => {
      mockSend.mockResolvedValueOnce({});

      await expect(
        service.deleteFile('projects/proj-1/src/index.ts'),
      ).resolves.toBeUndefined();
    });
  });

  describe('listProjectFiles', () => {
    beforeEach(async () => {
      mockSend.mockResolvedValueOnce({}); // HeadBucket
      await service.onModuleInit();
    });

    it('should list all file keys for a project', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [
          { Key: 'projects/proj-1/src/index.ts' },
          { Key: 'projects/proj-1/src/app.ts' },
        ],
        IsTruncated: false,
      });

      const keys = await service.listProjectFiles('proj-1');
      expect(keys).toEqual([
        'projects/proj-1/src/index.ts',
        'projects/proj-1/src/app.ts',
      ]);
    });

    it('should handle pagination', async () => {
      mockSend
        .mockResolvedValueOnce({
          Contents: [{ Key: 'projects/proj-1/a.ts' }],
          IsTruncated: true,
          NextContinuationToken: 'token-1',
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: 'projects/proj-1/b.ts' }],
          IsTruncated: false,
        });

      const keys = await service.listProjectFiles('proj-1');
      expect(keys).toEqual(['projects/proj-1/a.ts', 'projects/proj-1/b.ts']);
    });
  });
});
