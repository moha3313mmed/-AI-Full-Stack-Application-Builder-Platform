import { describe, it, expect, vi, beforeEach } from 'vitest';

import { QueueService } from '../queue.service';

// Mock bullmq
vi.mock('bullmq', () => {
  const mockJob = {
    id: 'job-1',
    name: 'test-job',
    data: { key: 'value' },
    remove: vi.fn().mockResolvedValue(undefined),
  };

  const MockQueue = vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue(mockJob),
    addBulk: vi.fn().mockResolvedValue([mockJob]),
    getJob: vi.fn().mockResolvedValue(mockJob),
    close: vi.fn().mockResolvedValue(undefined),
  }));

  return { Queue: MockQueue };
});

describe('QueueService', () => {
  let service: QueueService;
  const defaultConnection = { host: 'localhost', port: 6379 };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new QueueService();
  });

  describe('createQueue', () => {
    it('should create a new queue with the given config', async () => {
      const queue = await service.createQueue({
        name: 'test-queue',
        connection: defaultConnection,
      });

      expect(queue).toBeDefined();
      expect(queue.add).toBeDefined();
    });

    it('should return existing queue if already created', async () => {
      const queue1 = await service.createQueue({
        name: 'test-queue',
        connection: defaultConnection,
      });
      const queue2 = await service.createQueue({
        name: 'test-queue',
        connection: defaultConnection,
      });

      expect(queue1).toBe(queue2);
    });

    it('should support default job options', async () => {
      const queue = await service.createQueue({
        name: 'test-queue',
        connection: defaultConnection,
        defaultJobOptions: { attempts: 3 },
      });

      expect(queue).toBeDefined();
    });
  });

  describe('addJob', () => {
    it('should add a job to an existing queue', async () => {
      await service.createQueue({
        name: 'test-queue',
        connection: defaultConnection,
      });

      const job = await service.addJob('test-queue', 'my-job', {
        payload: 'test',
      });

      expect(job).toBeDefined();
      expect(job.id).toBe('job-1');
    });

    it('should throw if queue does not exist', async () => {
      await expect(
        service.addJob('non-existent', 'my-job', {}),
      ).rejects.toThrow('Queue "non-existent" not found');
    });

    it('should support priority option', async () => {
      await service.createQueue({
        name: 'test-queue',
        connection: defaultConnection,
      });

      const job = await service.addJob(
        'test-queue',
        'priority-job',
        { data: 'important' },
        { priority: 1 },
      );

      expect(job).toBeDefined();
    });

    it('should support delay option', async () => {
      await service.createQueue({
        name: 'test-queue',
        connection: defaultConnection,
      });

      const job = await service.addJob(
        'test-queue',
        'delayed-job',
        { data: 'later' },
        { delay: 5000 },
      );

      expect(job).toBeDefined();
    });

    it('should support retry and backoff options', async () => {
      await service.createQueue({
        name: 'test-queue',
        connection: defaultConnection,
      });

      const job = await service.addJob(
        'test-queue',
        'retry-job',
        { data: 'retry-me' },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        },
      );

      expect(job).toBeDefined();
    });
  });

  describe('addBulk', () => {
    it('should add multiple jobs at once', async () => {
      await service.createQueue({
        name: 'test-queue',
        connection: defaultConnection,
      });

      const jobs = await service.addBulk('test-queue', [
        { name: 'job-1', data: { a: 1 } },
        { name: 'job-2', data: { b: 2 }, options: { priority: 2 } },
      ]);

      expect(jobs).toBeDefined();
      expect(Array.isArray(jobs)).toBe(true);
    });

    it('should throw if queue does not exist', async () => {
      await expect(
        service.addBulk('non-existent', [{ name: 'j', data: {} }]),
      ).rejects.toThrow('Queue "non-existent" not found');
    });
  });

  describe('getJob', () => {
    it('should retrieve a job by ID', async () => {
      await service.createQueue({
        name: 'test-queue',
        connection: defaultConnection,
      });

      const job = await service.getJob('test-queue', 'job-1');
      expect(job).toBeDefined();
      expect(job?.id).toBe('job-1');
    });

    it('should throw if queue does not exist', async () => {
      await expect(
        service.getJob('non-existent', 'job-1'),
      ).rejects.toThrow('Queue "non-existent" not found');
    });
  });

  describe('removeJob', () => {
    it('should remove a job by ID', async () => {
      await service.createQueue({
        name: 'test-queue',
        connection: defaultConnection,
      });

      await service.removeJob('test-queue', 'job-1');
      // Should not throw
    });

    it('should handle removing a non-existent job gracefully', async () => {
      await service.createQueue({
        name: 'test-queue',
        connection: defaultConnection,
      });

      // Mock getJob to return null
      const queue = service.getQueue('test-queue');
      vi.mocked(queue.getJob).mockResolvedValueOnce(undefined as never);

      await service.removeJob('test-queue', 'non-existent');
      // Should not throw
    });
  });

  describe('closeAll', () => {
    it('should close all queues', async () => {
      await service.createQueue({
        name: 'queue-1',
        connection: defaultConnection,
      });
      await service.createQueue({
        name: 'queue-2',
        connection: defaultConnection,
      });

      await service.closeAll();

      // After closing, getQueue should throw
      expect(() => service.getQueue('queue-1')).toThrow();
      expect(() => service.getQueue('queue-2')).toThrow();
    });
  });
});
