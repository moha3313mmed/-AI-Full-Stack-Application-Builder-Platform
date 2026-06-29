import { IsArray, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export enum MemoryCategoryDto {
  ARCHITECTURE = 'ARCHITECTURE',
  CODING_STANDARDS = 'CODING_STANDARDS',
  USER_PREFERENCES = 'USER_PREFERENCES',
  FEATURE_HISTORY = 'FEATURE_HISTORY',
  BUSINESS_RULES = 'BUSINESS_RULES',
  DESIGN_LANGUAGE = 'DESIGN_LANGUAGE',
  DATABASE_EVOLUTION = 'DATABASE_EVOLUTION',
  DECISIONS = 'DECISIONS',
}

export class CreateMemoryDto {
  @IsEnum(MemoryCategoryDto)
  category!: MemoryCategoryDto;

  @IsString()
  title!: string;

  @IsString()
  content!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
