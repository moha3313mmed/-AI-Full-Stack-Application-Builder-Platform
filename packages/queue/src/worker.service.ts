import { Worker, type Job } from 'bullmq';

import type { WorkerConfig, JobResult } from './types';

export type JobProcessor = (job: Job) => Promise<JobResult>;

export class WorkerService {
  private workers: Map<string, Worker> = new Map();

  createWorker(
    config: WorkerConfig,
    processor: JobProcessor,
  ): Worker {
    const workerKey = `${config.queueName}`;

    if (this.workers.has(workerKey)) {
      throw new Error(
        `Worker for queue "${config.queueName}" already exists. Close it first.`,
      );
    }

    const worker = new Worker(
      config.queueName,
      async (job: Job) => {
        return processor(job);
      },
      {
        connection: config.connection,
        concurrency: config.concurrency ?? 1,
      },
    );

    this.workers.set(workerKey, worker);
    return worker;
  }

  getWorker(queueName: string): Worker | undefined {
    return this.workers.get(queueName);
  }

  async closeWorker(queueName: string): Promise<void> {
    const worker = this.workers.get(queueName);
    if (worker) {
      await worker.close();
      this.workers.delete(queueName);
    }
  }

  async gracefulShutdown(): Promise<void> {
    const closePromises = Array.from(this.workers.entries()).map(
      async ([key, worker]) => {
        await worker.close();
        this.workers.delete(key);
      },
    );
    await Promise.all(closePromises);
  }

  getActiveWorkers(): string[] {
    return Array.from(this.workers.keys());
  }
}
