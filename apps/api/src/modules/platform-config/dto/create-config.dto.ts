import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export enum ConfigCategoryDto {
  AI_PROVIDERS = 'AI_PROVIDERS',
  DEPLOYMENT_PROVIDERS = 'DEPLOYMENT_PROVIDERS',
  SOURCE_CONTROL = 'SOURCE_CONTROL',
  AUTH_PROVIDERS = 'AUTH_PROVIDERS',
  DATABASES = 'DATABASES',
  OBJECT_STORAGE = 'OBJECT_STORAGE',
  EMAIL_PROVIDERS = 'EMAIL_PROVIDERS',
  PAYMENT_PROVIDERS = 'PAYMENT_PROVIDERS',
  MONITORING_ANALYTICS = 'MONITORING_ANALYTICS',
}

export class CreateConfigDto {
  @ApiProperty({ enum: ConfigCategoryDto, description: 'Configuration category' })
  @IsEnum(ConfigCategoryDto)
  category!: ConfigCategoryDto;

  @ApiProperty({ description: 'Configuration key identifier' })
  @IsString()
  key!: string;

  @ApiProperty({ description: 'Configuration value (will be encrypted if secret)' })
  @IsString()
  value!: string;

  @ApiProperty({ description: 'Human-readable display name' })
  @IsString()
  displayName!: string;

  @ApiPropertyOptional({ description: 'Optional description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether this value is a secret', default: true })
  @IsOptional()
  @IsBoolean()
  isSecret?: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata', default: {} })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
