import { describe, it, expect, vi, beforeEach } from 'vitest';

import { WorkerService } from '../worker.service';

// Mock bullmq
vi.mock('bullmq', () => {
  const MockWorker = vi.fn().mockImplementation(() => ({
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  }));

  return { Worker: MockWorker };
});

describe('WorkerService', () => {
  let service: WorkerService;
  const defaultConnection = { host: 'localhost', port: 6379 };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkerService();
  });

  describe('createWorker', () => {
    it('should create a worker for the given queue', () => {
      const processor = vi.fn().mockResolvedValue({ success: true });

      const worker = service.createWorker(
        { queueName: 'test-queue', connection: defaultConnection },
        processor,
      );

      expect(worker).toBeDefined();
    });

    it('should throw if worker for queue already exists', () => {
      const processor = vi.fn().mockResolvedValue({ success: true });

      service.createWorker(
        { queueName: 'test-queue', connection: defaultConnection },
        processor,
      );

      expect(() =>
        service.createWorker(
          { queueName: 'test-queue', connection: defaultConnection },
          processor,
        ),
      ).toThrow('Worker for queue "test-queue" already exists');
    });

    it('should support concurrency configuration', () => {
      const processor = vi.fn().mockResolvedValue({ success: true });

      const worker = service.createWorker(
        {
          queueName: 'test-queue',
          connection: defaultConnection,
          concurrency: 5,
        },
        processor,
      );

      expect(worker).toBeDefined();
    });
  });

  describe('getWorker', () => {
    it('should return a created worker', () => {
      const processor = vi.fn().mockResolvedValue({ success: true });
      service.createWorker(
        { queueName: 'test-queue', connection: defaultConnection },
        processor,
      );

      const worker = service.getWorker('test-queue');
      expect(worker).toBeDefined();
    });

    it('should return undefined for non-existent worker', () => {
      const worker = service.getWorker('non-existent');
      expect(worker).toBeUndefined();
    });
  });

  describe('closeWorker', () => {
    it('should close and remove a specific worker', async () => {
      const processor = vi.fn().mockResolvedValue({ success: true });
      service.createWorker(
        { queueName: 'test-queue', connection: defaultConnection },
        processor,
      );

      await service.closeWorker('test-queue');

      const worker = service.getWorker('test-queue');
      expect(worker).toBeUndefined();
    });

    it('should handle closing non-existent worker gracefully', async () => {
      await service.closeWorker('non-existent');
      // Should not throw
    });
  });

  describe('gracefulShutdown', () => {
    it('should close all workers', async () => {
      const processor = vi.fn().mockResolvedValue({ success: true });

      service.createWorker(
        { queueName: 'queue-1', connection: defaultConnection },
        processor,
      );
      service.createWorker(
        { queueName: 'queue-2', connection: defaultConnection },
        processor,
      );

      await service.gracefulShutdown();

      expect(service.getActiveWorkers()).toHaveLength(0);
    });
  });

  describe('getActiveWorkers', () => {
    it('should return list of active worker queue names', () => {
      const processor = vi.fn().mockResolvedValue({ success: true });

      service.createWorker(
        { queueName: 'queue-1', connection: defaultConnection },
        processor,
      );
      service.createWorker(
        { queueName: 'queue-2', connection: defaultConnection },
        processor,
      );

      const activeWorkers = service.getActiveWorkers();
      expect(activeWorkers).toHaveLength(2);
      expect(activeWorkers).toContain('queue-1');
      expect(activeWorkers).toContain('queue-2');
    });
  });
});
