import type { ConnectionOptions, JobsOptions } from 'bullmq';

export interface QueueConfig {
  name: string;
  connection: ConnectionOptions;
  defaultJobOptions?: JobsOptions;
}

export interface WorkerConfig {
  queueName: string;
  connection: ConnectionOptions;
  concurrency?: number;
}

export interface JobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
  jobId?: string;
}

export interface JobData {
  [key: string]: unknown;
}

export interface JobResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface RepeatableJobOptions {
  name: string;
  data?: JobData;
  pattern?: string; // cron pattern
  every?: number; // repeat every N milliseconds
  limit?: number; // max number of times to repeat
}
