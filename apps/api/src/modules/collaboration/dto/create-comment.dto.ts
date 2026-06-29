import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  content!: string;

  @IsString()
  @IsOptional()
  filePath?: string;

  @IsInt()
  @IsOptional()
  lineNumber?: number;

  @IsString()
  @IsOptional()
  threadId?: string;
}
