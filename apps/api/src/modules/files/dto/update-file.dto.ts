import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateFileDto {
  @ApiProperty({ example: 'export const hello = "updated";' })
  @IsString()
  content!: string;

  @ApiPropertyOptional({ example: 'typescript' })
  @IsOptional()
  @IsString()
  language?: string;
}
