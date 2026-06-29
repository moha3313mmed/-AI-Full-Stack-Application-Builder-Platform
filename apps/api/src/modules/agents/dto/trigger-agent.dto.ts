import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class TriggerAgentDto {
  @ApiProperty({ example: 'Build a landing page with hero section' })
  @IsString()
  @MinLength(1)
  task!: string;

  @ApiPropertyOptional({ example: 'project_123' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ example: { framework: 'nextjs' } })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
