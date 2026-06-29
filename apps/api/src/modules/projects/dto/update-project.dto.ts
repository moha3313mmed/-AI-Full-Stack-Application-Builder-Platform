import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'Updated App Name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'ACTIVE', 'BUILDING', 'DEPLOYED', 'ARCHIVED'] })
  @IsOptional()
  @IsEnum(['DRAFT', 'ACTIVE', 'BUILDING', 'DEPLOYED', 'ARCHIVED'])
  status?: string;

  @ApiPropertyOptional({ example: { theme: 'light' } })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
