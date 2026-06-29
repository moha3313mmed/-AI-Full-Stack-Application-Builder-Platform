import { Permission, TeamRole } from '../types/index.js';

/**
 * RoleHierarchy defines the inheritance chain for team roles.
 * OWNER > ADMIN > EDITOR > VIEWER
 *
 * Each role inherits permissions from all roles below it.
 */
export class RoleHierarchy {
  private static readonly hierarchy: TeamRole[] = [
    TeamRole.VIEWER,
    TeamRole.EDITOR,
    TeamRole.ADMIN,
    TeamRole.OWNER,
  ];

  private static readonly rolePermissions: Record<TeamRole, Permission[]> = {
    [TeamRole.VIEWER]: [Permission.PROJECT_VIEW],
    [TeamRole.EDITOR]: [
      Permission.PROJECT_EDIT,
      Permission.COMMENT_CREATE,
      Permission.CODE_REVIEW,
    ],
    [TeamRole.ADMIN]: [
      Permission.PROJECT_DELETE,
      Permission.PROJECT_DEPLOY,
      Permission.COMMENT_DELETE,
      Permission.TEAM_MANAGE,
    ],
    [TeamRole.OWNER]: [],
  };

  /**
   * Get all permissions for a role, including inherited ones.
   */
  static getPermissions(role: TeamRole): Permission[] {
    const roleIndex = this.hierarchy.indexOf(role);
    const permissions: Permission[] = [];

    for (let i = 0; i <= roleIndex; i++) {
      permissions.push(...this.rolePermissions[this.hierarchy[i]]);
    }

    return permissions;
  }

  /**
   * Check if role1 is higher or equal to role2 in the hierarchy.
   */
  static isHigherOrEqual(role1: TeamRole, role2: TeamRole): boolean {
    return this.hierarchy.indexOf(role1) >= this.hierarchy.indexOf(role2);
  }

  /**
   * Get the rank of a role (higher number = more permissions).
   */
  static getRank(role: TeamRole): number {
    return this.hierarchy.indexOf(role);
  }
}
