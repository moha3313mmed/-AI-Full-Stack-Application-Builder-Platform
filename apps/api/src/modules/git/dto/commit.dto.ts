import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class FileChangeDto {
  @IsString()
  path!: string;

  @IsString()
  content!: string;

  @IsString()
  operation!: 'add' | 'modify' | 'delete';
}

export class CommitDto {
  @IsString()
  message!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileChangeDto)
  files!: FileChangeDto[];

  @IsString()
  @IsOptional()
  branch?: string;
}
