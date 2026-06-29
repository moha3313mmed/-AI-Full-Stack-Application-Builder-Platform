import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ example: 'user', enum: ['user', 'assistant', 'system'] })
  @IsEnum(['user', 'assistant', 'system'])
  role!: string;

  @ApiProperty({ example: 'Help me build a landing page' })
  @IsString()
  @MinLength(1)
  content!: string;

  @ApiPropertyOptional({ example: { model: 'gpt-4' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
