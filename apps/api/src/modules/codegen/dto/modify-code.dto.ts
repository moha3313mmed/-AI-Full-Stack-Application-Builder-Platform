import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ModifyCodeDto {
  @ApiProperty({ example: 'Add error handling to the login function' })
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty({ example: '/src/auth/login.ts' })
  @IsString()
  @MinLength(1)
  filePath!: string;

  @ApiProperty({ example: 'Wrap the function body in a try-catch block' })
  @IsString()
  @MinLength(1)
  instruction!: string;
}
