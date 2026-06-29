import { SetMetadata } from '@nestjs/common';

export const AUDITED_KEY = 'audited';

export interface AuditedOptions {
  resource?: string;
  action?: string;
}

export const Audited = (options?: AuditedOptions) =>
  SetMetadata(AUDITED_KEY, options || {});
