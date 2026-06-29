export const JOB_TYPES = {
  SECURITY_SCAN: 'security-scan',
  USAGE_AGGREGATION: 'usage-aggregation',
  AUDIT_CLEANUP: 'audit-cleanup',
  EMAIL_NOTIFICATION: 'email-notification',
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

export const JOBS_QUEUE_NAME = 'builder-jobs';
