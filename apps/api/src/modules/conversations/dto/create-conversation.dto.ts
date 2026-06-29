import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateConversationDto {
  @ApiPropertyOptional({ example: 'Chat about landing page' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'project_123' })
  @IsOptional()
  @IsString()
  projectId?: string;
}
