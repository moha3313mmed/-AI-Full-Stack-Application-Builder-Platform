import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class ProcessMessageDto {
  @ApiProperty({ example: 'project_123', description: 'The project ID' })
  @IsString()
  projectId!: string;

  @ApiProperty({ example: 'conv_123', description: 'The conversation ID' })
  @IsString()
  conversationId!: string;

  @ApiProperty({ example: 'Build me a landing page with a hero section', description: 'The user message' })
  @IsString()
  @MinLength(1)
  message!: string;

  @ApiPropertyOptional({ example: 'nextjs', description: 'Optional framework hint' })
  @IsOptional()
  @IsString()
  framework?: string;
}
