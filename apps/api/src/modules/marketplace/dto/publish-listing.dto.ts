import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export enum MarketplaceCategoryDto {
  TOOLING = 'TOOLING',
  INTEGRATION = 'INTEGRATION',
  THEME = 'THEME',
  LANGUAGE = 'LANGUAGE',
  DEPLOYMENT = 'DEPLOYMENT',
  SECURITY = 'SECURITY',
  AI = 'AI',
  OTHER = 'OTHER',
}

export class PublishListingDto {
  @IsString()
  pluginId!: string;

  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsString()
  shortDescription!: string;

  @IsEnum(MarketplaceCategoryDto)
  category!: MarketplaceCategoryDto;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  icon?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  screenshots?: string[];

  @IsString()
  // TODO: Once authentication is implemented, authorId should be derived from
  // the authenticated session rather than accepted from the request body.
  // Accepting it from the body allows callers to impersonate other users.
  authorId!: string;
}
