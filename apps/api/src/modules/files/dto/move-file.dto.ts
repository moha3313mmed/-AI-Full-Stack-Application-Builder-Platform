import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class MoveFileDto {
  @ApiProperty({ example: '/src/old-name.ts' })
  @IsString()
  @MinLength(1)
  from!: string;

  @ApiProperty({ example: '/src/new-name.ts' })
  @IsString()
  @MinLength(1)
  to!: string;
}
