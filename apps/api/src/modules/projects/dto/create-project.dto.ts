import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'My Awesome App' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ example: 'A full-stack web application' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ['NEXTJS', 'REACT', 'VUE', 'SVELTE', 'EXPRESS', 'NESTJS'] })
  @IsEnum(['NEXTJS', 'REACT', 'VUE', 'SVELTE', 'EXPRESS', 'NESTJS'])
  framework!: string;

  @ApiProperty({ enum: ['TYPESCRIPT', 'JAVASCRIPT', 'PYTHON'] })
  @IsEnum(['TYPESCRIPT', 'JAVASCRIPT', 'PYTHON'])
  language!: string;

  @ApiPropertyOptional({ example: 'org_123' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ example: { theme: 'dark' } })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
