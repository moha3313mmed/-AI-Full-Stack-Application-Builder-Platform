import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum MarketplaceSortDto {
  NEWEST = 'newest',
  POPULAR = 'popular',
  RATING = 'rating',
}

export class SearchQueryDto {
  @IsString()
  @IsOptional()
  query?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsEnum(MarketplaceSortDto)
  @IsOptional()
  sort?: MarketplaceSortDto;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  offset?: number;
}
