import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export enum DeploymentProviderDto {
  VERCEL = 'VERCEL',
  NETLIFY = 'NETLIFY',
  RAILWAY = 'RAILWAY',
  RENDER = 'RENDER',
  FLY_IO = 'FLY_IO',
  DIGITALOCEAN = 'DIGITALOCEAN',
  AWS = 'AWS',
  AZURE = 'AZURE',
  GCP = 'GCP',
  CLOUDFLARE = 'CLOUDFLARE',
}

export class CreateDeploymentDto {
  @IsString()
  projectId!: string;

  @IsEnum(DeploymentProviderDto)
  provider!: DeploymentProviderDto;

  @IsString()
  @IsOptional()
  environment?: string;

  @IsString()
  @IsOptional()
  buildCommand?: string;

  @IsString()
  @IsOptional()
  outputDir?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  customDomain?: string;

  @IsString()
  @IsOptional()
  commitHash?: string;

  @IsObject()
  @IsOptional()
  envVars?: Record<string, string>;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}
