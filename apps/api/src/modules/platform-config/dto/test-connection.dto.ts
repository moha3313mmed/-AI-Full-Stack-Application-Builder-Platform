import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { ConfigCategoryDto } from './create-config.dto';

export class TestConnectionDto {
  @ApiProperty({ enum: ConfigCategoryDto, description: 'Configuration category' })
  @IsEnum(ConfigCategoryDto)
  category!: ConfigCategoryDto;

  @ApiProperty({ description: 'Configuration key' })
  @IsString()
  key!: string;

  @ApiPropertyOptional({ description: 'Value to test (plaintext). If omitted, the stored value for this category/key is used.' })
  @IsOptional()
  @IsString()
  value?: string;
}
