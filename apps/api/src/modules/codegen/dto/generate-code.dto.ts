import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class GenerateCodeDto {
  @ApiProperty({ example: 'Create a user authentication module with login and register' })
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiPropertyOptional({ example: 'nextjs', enum: ['nextjs', 'react', 'express', 'nestjs'] })
  @IsOptional()
  @IsString()
  @IsIn(['nextjs', 'react', 'express', 'nestjs'])
  framework?: string;

  @ApiPropertyOptional({ example: ['/src/auth/login.ts', '/src/auth/register.ts'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetFiles?: string[];
}
