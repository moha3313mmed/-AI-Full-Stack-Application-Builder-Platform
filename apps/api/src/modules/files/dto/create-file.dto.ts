import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateFileDto {
  @ApiProperty({ example: '/src/index.ts' })
  @IsString()
  @MinLength(1)
  path!: string;

  @ApiPropertyOptional({ example: 'export const hello = "world";', default: '' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ example: 'typescript' })
  @IsOptional()
  @IsString()
  language?: string;
}
