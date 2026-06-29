import { IsObject, IsOptional, IsString } from 'class-validator';

export enum PluginCategoryDto {
  AI_AGENT = 'AI_AGENT',
  INTEGRATION = 'INTEGRATION',
  THEME = 'THEME',
  ANALYTICS = 'ANALYTICS',
  SECURITY = 'SECURITY',
  DEPLOYMENT = 'DEPLOYMENT',
  UTILITY = 'UTILITY',
}

export class InstallPluginDto {
  @IsString()
  pluginId!: string;

  @IsString()
  projectId!: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}
