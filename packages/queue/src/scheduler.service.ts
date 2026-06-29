import { Queue } from 'bullmq';

import type { QueueConfig, RepeatableJobOptions } from './types';

export class SchedulerService {
  private queues: Map<string, Queue> = new Map();

  async createScheduler(config: QueueConfig): Promise<void> {
    if (this.queues.has(config.name)) {
      return;
    }

    const queue = new Queue(config.name, {
      connection: config.connection,
      defaultJobOptions: config.defaultJobOptions,
    });

    this.queues.set(config.name, queue);
  }

  async addRepeatableJob(
    queueName: string,
    options: RepeatableJobOptions,
  ) {
    const queue = this.getQueue(queueName);

    const repeatOpts: Record<string, unknown> = {};
    if (options.pattern) {
      repeatOpts.pattern = options.pattern;
    }
    if (options.every !== undefined) {
      repeatOpts.every = options.every;
    }
    if (options.limit !== undefined) {
      repeatOpts.limit = options.limit;
    }

    return queue.add(options.name, options.data ?? {}, {
      repeat: repeatOpts as { pattern?: string; every?: number; limit?: number },
    });
  }

  async removeRepeatableJob(
    queueName: string,
    jobName: string,
    pattern?: string,
    every?: number,
  ): Promise<boolean> {
    const queue = this.getQueue(queueName);

    const repeatOpts: Record<string, unknown> = {};
    if (pattern) {
      repeatOpts.pattern = pattern;
    }
    if (every !== undefined) {
      repeatOpts.every = every;
    }

    return queue.removeRepeatable(
      jobName,
      repeatOpts as { pattern?: string; every?: number },
    );
  }

  async getRepeatableJobs(queueName: string) {
    const queue = this.getQueue(queueName);
    return queue.getRepeatableJobs();
  }

  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map((queue) =>
      queue.close(),
    );
    await Promise.all(closePromises);
    this.queues.clear();
  }

  private getQueue(queueName: string): Queue {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(
        `Scheduler for queue "${queueName}" not found. Create it first with createScheduler().`,
      );
    }
    return queue;
  }
}
