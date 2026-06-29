import { IsIn, IsString } from 'class-validator';

const VALID_ROLES = ['USER', 'ADMIN', 'SUPER_ADMIN'] as const;

export class UpdateUserRoleDto {
  @IsString()
  @IsIn(VALID_ROLES, {
    message: `role must be one of: ${VALID_ROLES.join(', ')}`,
  })
  role!: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
}
