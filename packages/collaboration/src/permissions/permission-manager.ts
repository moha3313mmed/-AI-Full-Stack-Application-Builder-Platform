import { Permission, TeamMember, TeamRole } from '../types/index.js';

import { RoleHierarchy } from './role-hierarchy.js';

/**
 * PermissionManager checks whether a user/role has a given permission.
 * Uses role-to-permissions mapping with hierarchy inheritance.
 */
export class PermissionManager {
  private members: Map<string, Map<string, TeamMember>> = new Map();

  /**
   * Register a team member for a project.
   */
  addMember(projectId: string, member: TeamMember): void {
    if (!this.members.has(projectId)) {
      this.members.set(projectId, new Map());
    }
    this.members.get(projectId)!.set(member.userId, member);
  }

  /**
   * Remove a team member from a project.
   */
  removeMember(projectId: string, userId: string): void {
    this.members.get(projectId)?.delete(userId);
  }

  /**
   * Check if a role has a specific permission.
   */
  hasPermission(role: TeamRole, permission: Permission): boolean {
    const rolePermissions = RoleHierarchy.getPermissions(role);
    return rolePermissions.includes(permission);
  }

  /**
   * Get all permissions for a role.
   */
  getPermissions(role: TeamRole): Permission[] {
    return RoleHierarchy.getPermissions(role);
  }

  /**
   * Check if a user can perform a specific action on a project.
   */
  canPerformAction(userId: string, projectId: string, action: Permission): boolean {
    const projectMembers = this.members.get(projectId);
    if (!projectMembers) {
      return false;
    }

    const member = projectMembers.get(userId);
    if (!member) {
      return false;
    }

    // Check role-based permissions
    if (this.hasPermission(member.role, action)) {
      return true;
    }

    // Check explicit permissions granted to the member
    if (member.permissions.includes(action)) {
      return true;
    }

    return false;
  }

  /**
   * Get a member's effective permissions (role-based + explicit).
   */
  getEffectivePermissions(userId: string, projectId: string): Permission[] {
    const projectMembers = this.members.get(projectId);
    if (!projectMembers) {
      return [];
    }

    const member = projectMembers.get(userId);
    if (!member) {
      return [];
    }

    const rolePermissions = RoleHierarchy.getPermissions(member.role);
    const allPermissions = new Set([...rolePermissions, ...member.permissions]);
    return Array.from(allPermissions);
  }
}
