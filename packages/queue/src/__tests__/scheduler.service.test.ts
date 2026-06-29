import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SchedulerService } from '../scheduler.service';

// Mock bullmq
const mockRepeatableJobs = [
  { key: 'job-1', name: 'daily-report', endDate: null, tz: null, pattern: '0 0 * * *', next: 1234567890 },
  { key: 'job-2', name: 'health-check', endDate: null, tz: null, every: '5000', next: 1234567891 },
];

vi.mock('bullmq', () => {
  const MockQueue = vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'repeatable-1', name: 'test-job' }),
    removeRepeatable: vi.fn().mockResolvedValue(true),
    getRepeatableJobs: vi.fn().mockResolvedValue(mockRepeatableJobs),
    close: vi.fn().mockResolvedValue(undefined),
  }));

  return { Queue: MockQueue };
});

describe('SchedulerService', () => {
  let service: SchedulerService;
  const defaultConnection = { host: 'localhost', port: 6379 };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SchedulerService();
  });

  describe('createScheduler', () => {
    it('should create a scheduler for the given queue', async () => {
      await service.createScheduler({
        name: 'scheduler-queue',
        connection: defaultConnection,
      });

      // Should not throw when adding repeatable jobs
      const job = await service.addRepeatableJob('scheduler-queue', {
        name: 'test-repeat',
        pattern: '*/5 * * * *',
      });
      expect(job).toBeDefined();
    });

    it('should not recreate if scheduler already exists', async () => {
      await service.createScheduler({
        name: 'scheduler-queue',
        connection: defaultConnection,
      });
      await service.createScheduler({
        name: 'scheduler-queue',
        connection: defaultConnection,
      });

      // Should still work
      const jobs = await service.getRepeatableJobs('scheduler-queue');
      expect(jobs).toBeDefined();
    });
  });

  describe('addRepeatableJob', () => {
    it('should add a cron-based repeatable job', async () => {
      await service.createScheduler({
        name: 'scheduler-queue',
        connection: defaultConnection,
      });

      const job = await service.addRepeatableJob('scheduler-queue', {
        name: 'daily-cleanup',
        data: { type: 'cleanup' },
        pattern: '0 0 * * *',
      });

      expect(job).toBeDefined();
    });

    it('should add an interval-based repeatable job', async () => {
      await service.createScheduler({
        name: 'scheduler-queue',
        connection: defaultConnection,
      });

      const job = await service.addRepeatableJob('scheduler-queue', {
        name: 'health-check',
        every: 5000,
      });

      expect(job).toBeDefined();
    });

    it('should support limit option', async () => {
      await service.createScheduler({
        name: 'scheduler-queue',
        connection: defaultConnection,
      });

      const job = await service.addRepeatableJob('scheduler-queue', {
        name: 'limited-job',
        every: 1000,
        limit: 10,
      });

      expect(job).toBeDefined();
    });

    it('should throw if scheduler does not exist', async () => {
      await expect(
        service.addRepeatableJob('non-existent', {
          name: 'test',
          pattern: '* * * * *',
        }),
      ).rejects.toThrow('Scheduler for queue "non-existent" not found');
    });
  });

  describe('removeRepeatableJob', () => {
    it('should remove a repeatable job by name and pattern', async () => {
      await service.createScheduler({
        name: 'scheduler-queue',
        connection: defaultConnection,
      });

      const result = await service.removeRepeatableJob(
        'scheduler-queue',
        'daily-cleanup',
        '0 0 * * *',
      );

      expect(result).toBe(true);
    });

    it('should remove a repeatable job by name and every', async () => {
      await service.createScheduler({
        name: 'scheduler-queue',
        connection: defaultConnection,
      });

      const result = await service.removeRepeatableJob(
        'scheduler-queue',
        'health-check',
        undefined,
        5000,
      );

      expect(result).toBe(true);
    });

    it('should throw if scheduler does not exist', async () => {
      await expect(
        service.removeRepeatableJob('non-existent', 'job'),
      ).rejects.toThrow('Scheduler for queue "non-existent" not found');
    });
  });

  describe('getRepeatableJobs', () => {
    it('should return all repeatable jobs for a queue', async () => {
      await service.createScheduler({
        name: 'scheduler-queue',
        connection: defaultConnection,
      });

      const jobs = await service.getRepeatableJobs('scheduler-queue');

      expect(jobs).toHaveLength(2);
      expect(jobs[0].name).toBe('daily-report');
      expect(jobs[1].name).toBe('health-check');
    });

    it('should throw if scheduler does not exist', async () => {
      await expect(
        service.getRepeatableJobs('non-existent'),
      ).rejects.toThrow('Scheduler for queue "non-existent" not found');
    });
  });

  describe('closeAll', () => {
    it('should close all scheduler queues', async () => {
      await service.createScheduler({
        name: 'queue-1',
        connection: defaultConnection,
      });
      await service.createScheduler({
        name: 'queue-2',
        connection: defaultConnection,
      });

      await service.closeAll();

      // Should throw since queues are closed
      await expect(
        service.addRepeatableJob('queue-1', { name: 'test', pattern: '* * * * *' }),
      ).rejects.toThrow('Scheduler for queue "queue-1" not found');
    });
  });
});
