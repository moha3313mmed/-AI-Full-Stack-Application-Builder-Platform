import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export enum GitProviderDto {
  GITHUB = 'GITHUB',
  GITLAB = 'GITLAB',
  BITBUCKET = 'BITBUCKET',
}

export class CreateRepositoryDto {
  @IsString()
  projectId!: string;

  @IsEnum(GitProviderDto)
  provider!: GitProviderDto;

  @IsString()
  owner!: string;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  defaultBranch?: string;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}
