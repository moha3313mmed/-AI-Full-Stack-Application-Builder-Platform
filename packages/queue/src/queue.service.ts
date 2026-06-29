import { Queue, type JobsOptions } from 'bullmq';

import type { QueueConfig, JobOptions, JobData } from './types';

export class QueueService {
  private queues: Map<string, Queue> = new Map();

  async createQueue(config: QueueConfig): Promise<Queue> {
    if (this.queues.has(config.name)) {
      return this.queues.get(config.name)!;
    }

    const queue = new Queue(config.name, {
      connection: config.connection,
      defaultJobOptions: config.defaultJobOptions,
    });

    this.queues.set(config.name, queue);
    return queue;
  }

  async addJob(
    queueName: string,
    jobName: string,
    data: JobData,
    options?: JobOptions,
  ) {
    const queue = this.getQueue(queueName);
    const bullOptions = this.mapJobOptions(options);
    return queue.add(jobName, data, bullOptions);
  }

  async addBulk(
    queueName: string,
    jobs: Array<{ name: string; data: JobData; options?: JobOptions }>,
  ) {
    const queue = this.getQueue(queueName);
    const mappedJobs = jobs.map((job) => ({
      name: job.name,
      data: job.data,
      opts: this.mapJobOptions(job.options),
    }));
    return queue.addBulk(mappedJobs);
  }

  async getJob(queueName: string, jobId: string) {
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId);
  }

  async removeJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }

  getQueue(queueName: string): Queue {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue "${queueName}" not found. Create it first with createQueue().`);
    }
    return queue;
  }

  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map((queue) =>
      queue.close(),
    );
    await Promise.all(closePromises);
    this.queues.clear();
  }

  private mapJobOptions(options?: JobOptions): JobsOptions | undefined {
    if (!options) return undefined;
    return {
      priority: options.priority,
      delay: options.delay,
      attempts: options.attempts,
      backoff: options.backoff,
      removeOnComplete: options.removeOnComplete,
      removeOnFail: options.removeOnFail,
      jobId: options.jobId,
    };
  }
}
