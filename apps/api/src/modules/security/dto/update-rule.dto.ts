import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpdateRuleDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}
