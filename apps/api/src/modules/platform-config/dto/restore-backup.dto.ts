import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { ConfigCategoryDto } from './create-config.dto';

export class RestoreBackupConfigItemDto {
  @ApiProperty({ enum: ConfigCategoryDto, description: 'Configuration category' })
  @IsEnum(ConfigCategoryDto)
  category!: ConfigCategoryDto;

  @ApiProperty({ description: 'Configuration key' })
  @IsString()
  key!: string;

  @ApiProperty({ description: 'Encrypted configuration value' })
  @IsString()
  value!: string;

  @ApiProperty({ description: 'Human-readable display name' })
  @IsString()
  displayName!: string;

  @ApiProperty({ description: 'Optional description', required: false })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ description: 'Whether this value is a secret' })
  @IsBoolean()
  isSecret!: boolean;

  @ApiProperty({ description: 'Whether this config is active' })
  @IsBoolean()
  isActive!: boolean;

  @ApiProperty({ description: 'Additional metadata', required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class RestoreBackupDto {
  @ApiProperty({ description: 'Backup format version' })
  @IsNumber()
  version!: number;

  @ApiProperty({ description: 'Array of configuration items to restore', type: [RestoreBackupConfigItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RestoreBackupConfigItemDto)
  configs!: RestoreBackupConfigItemDto[];
}
