import { QueueService } from '@builder/queue';
import type { JobOptions } from '@builder/queue';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfiguration } from '../../config/configuration';

import { JOBS_QUEUE_NAME } from './jobs.constants';
import type { JobType } from './jobs.constants';

export interface EnqueueOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  jobId?: string;
}

export interface JobStatus {
  id: string;
  name: string;
  status: string;
  data: unknown;
  progress: number;
  attemptsMade: number;
  failedReason?: string;
  finishedOn?: number;
  processedOn?: number;
}

@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private queueService: QueueService;
  private initialized = false;

  constructor(private readonly configService: ConfigService<AppConfiguration>) {
    this.queueService = new QueueService();
    this.initializeQueue();
  }

  private initializeQueue(): void {
    const redisUrl = this.configService.get('redis', { infer: true })?.url ?? 'redis://localhost:6379';
    const parsed = this.parseRedisUrl(redisUrl);

    this.queueService
      .createQueue({
        name: JOBS_QUEUE_NAME,
        connection: {
          host: parsed.host,
          port: parsed.port,
          password: parsed.password,
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 500,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      })
      .then(() => {
        this.initialized = true;
        this.logger.log('Jobs queue initialized successfully');
      })
      .catch((error) => {
        this.logger.error('Failed to initialize jobs queue', error);
      });
  }

  async enqueueJob(type: JobType, data: Record<string, unknown>, options?: EnqueueOptions): Promise<string> {
    const jobOptions: JobOptions = {
      priority: options?.priority,
      delay: options?.delay,
      attempts: options?.attempts,
      jobId: options?.jobId,
    };

    const job = await this.queueService.addJob(JOBS_QUEUE_NAME, type, data, jobOptions);
    this.logger.debug(`Enqueued job: ${type} (${job.id})`);
    return job.id ?? '';
  }

  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const job = await this.queueService.getJob(JOBS_QUEUE_NAME, jobId);
    if (!job) return null;

    const state = await job.getState();
    return {
      id: job.id ?? '',
      name: job.name,
      status: state,
      data: job.data,
      progress: typeof job.progress === 'number' ? job.progress : 0,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason ?? undefined,
      finishedOn: job.finishedOn ?? undefined,
      processedOn: job.processedOn ?? undefined,
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async onModuleDestroy(): Promise<void> {
    await this.queueService.closeAll();
  }

  private parseRedisUrl(url: string): { host: string; port: number; password?: string } {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname || 'localhost',
        port: parseInt(parsed.port || '6379', 10),
        password: parsed.password || undefined,
      };
    } catch {
      return { host: 'localhost', port: 6379 };
    }
  }
}
