import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class ScaffoldProjectDto {
  @ApiProperty({ example: 'nextjs', enum: ['nextjs', 'react', 'express', 'nestjs'] })
  @IsString()
  @IsIn(['nextjs', 'react', 'express', 'nestjs'])
  framework!: string;

  @ApiPropertyOptional({ example: 'my-app' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: 'typescript', enum: ['typescript', 'javascript'] })
  @IsOptional()
  @IsString()
  @IsIn(['typescript', 'javascript'])
  language?: string;
}
