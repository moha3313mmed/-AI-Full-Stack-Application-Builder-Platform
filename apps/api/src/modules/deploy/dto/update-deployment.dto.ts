import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export enum DeploymentStatusDto {
  PENDING = 'PENDING',
  BUILDING = 'BUILDING',
  DEPLOYING = 'DEPLOYING',
  DEPLOYED = 'DEPLOYED',
  FAILED = 'FAILED',
  ROLLED_BACK = 'ROLLED_BACK',
}

export class UpdateDeploymentDto {
  @IsEnum(DeploymentStatusDto)
  @IsOptional()
  status?: DeploymentStatusDto;

  @IsString()
  @IsOptional()
  url?: string;

  @IsObject()
  @IsOptional()
  logs?: unknown[];

  @IsOptional()
  buildDuration?: number;

  @IsOptional()
  deployDuration?: number;
}
