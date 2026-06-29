import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { JOB_TYPES } from './jobs.constants';
import { JobsService } from './jobs.service';

// Mock @builder/queue
const mockAddJob = jest.fn().mockResolvedValue({ id: 'job-123' });
const mockGetJob = jest.fn();
const mockCreateQueue = jest.fn().mockResolvedValue({});
const mockCloseAll = jest.fn().mockResolvedValue(undefined);

jest.mock('@builder/queue', () => ({
  QueueService: jest.fn().mockImplementation(() => ({
    createQueue: mockCreateQueue,
    addJob: mockAddJob,
    getJob: mockGetJob,
    closeAll: mockCloseAll,
  })),
}));

describe('JobsService', () => {
  let service: JobsService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue({ url: 'redis://localhost:6379' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enqueueJob', () => {
    it('should enqueue a job and return its ID', async () => {
      const jobId = await service.enqueueJob(
        JOB_TYPES.SECURITY_SCAN,
        { projectId: 'proj-1' },
      );

      expect(jobId).toBe('job-123');
      expect(mockAddJob).toHaveBeenCalledWith(
        'builder-jobs',
        'security-scan',
        { projectId: 'proj-1' },
        expect.any(Object),
      );
    });

    it('should pass options to the queue', async () => {
      await service.enqueueJob(
        JOB_TYPES.EMAIL_NOTIFICATION,
        { to: 'user@example.com' },
        { priority: 1, delay: 5000, attempts: 5 },
      );

      expect(mockAddJob).toHaveBeenCalledWith(
        'builder-jobs',
        'email-notification',
        { to: 'user@example.com' },
        expect.objectContaining({
          priority: 1,
          delay: 5000,
          attempts: 5,
        }),
      );
    });

    it('should support all job types', async () => {
      for (const type of Object.values(JOB_TYPES)) {
        await service.enqueueJob(type, {});
      }

      expect(mockAddJob).toHaveBeenCalledTimes(4);
    });
  });

  describe('getJobStatus', () => {
    it('should return job status when job exists', async () => {
      mockGetJob.mockResolvedValue({
        id: 'job-123',
        name: 'security-scan',
        data: { projectId: 'proj-1' },
        progress: 50,
        attemptsMade: 1,
        failedReason: null,
        finishedOn: null,
        processedOn: Date.now(),
        getState: jest.fn().mockResolvedValue('active'),
      });

      const status = await service.getJobStatus('job-123');

      expect(status).not.toBeNull();
      expect(status!.id).toBe('job-123');
      expect(status!.name).toBe('security-scan');
      expect(status!.status).toBe('active');
      expect(status!.progress).toBe(50);
    });

    it('should return null when job does not exist', async () => {
      mockGetJob.mockResolvedValue(null);

      const status = await service.getJobStatus('non-existent');

      expect(status).toBeNull();
    });
  });

  describe('onModuleDestroy', () => {
    it('should close all queue connections', async () => {
      await service.onModuleDestroy();

      expect(mockCloseAll).toHaveBeenCalled();
    });
  });
});
