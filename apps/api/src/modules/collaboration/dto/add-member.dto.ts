import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export enum TeamRoleDto {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export class AddMemberDto {
  @IsString()
  userId!: string;

  @IsEnum(TeamRoleDto)
  role!: TeamRoleDto;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];
}
