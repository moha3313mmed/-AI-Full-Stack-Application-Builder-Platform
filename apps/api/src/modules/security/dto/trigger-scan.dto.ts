import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum SecurityScanTypeDto {
  VULNERABILITY = 'VULNERABILITY',
  SECRET_DETECTION = 'SECRET_DETECTION',
  SQL_INJECTION = 'SQL_INJECTION',
  XSS = 'XSS',
  CSRF = 'CSRF',
  AUTH_REVIEW = 'AUTH_REVIEW',
  OWASP_FULL = 'OWASP_FULL',
}

export class TriggerScanDto {
  @IsString()
  projectId!: string;

  @IsEnum(SecurityScanTypeDto)
  scanType!: SecurityScanTypeDto;

  @IsString()
  @IsOptional()
  triggeredBy?: string;
}
