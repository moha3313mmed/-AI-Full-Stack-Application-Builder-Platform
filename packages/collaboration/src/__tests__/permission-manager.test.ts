import { describe, it, expect, beforeEach } from 'vitest';

import { PermissionManager } from '../permissions/permission-manager.js';
import { RoleHierarchy } from '../permissions/role-hierarchy.js';
import { Permission, TeamRole, TeamMember } from '../types/index.js';

describe('PermissionManager', () => {
  let manager: PermissionManager;

  beforeEach(() => {
    manager = new PermissionManager();
  });

  describe('hasPermission', () => {
    it('should grant OWNER all permissions', () => {
      expect(manager.hasPermission(TeamRole.OWNER, Permission.PROJECT_VIEW)).toBe(true);
      expect(manager.hasPermission(TeamRole.OWNER, Permission.PROJECT_EDIT)).toBe(true);
      expect(manager.hasPermission(TeamRole.OWNER, Permission.PROJECT_DELETE)).toBe(true);
      expect(manager.hasPermission(TeamRole.OWNER, Permission.PROJECT_DEPLOY)).toBe(true);
      expect(manager.hasPermission(TeamRole.OWNER, Permission.TEAM_MANAGE)).toBe(true);
      expect(manager.hasPermission(TeamRole.OWNER, Permission.COMMENT_CREATE)).toBe(true);
      expect(manager.hasPermission(TeamRole.OWNER, Permission.COMMENT_DELETE)).toBe(true);
      expect(manager.hasPermission(TeamRole.OWNER, Permission.CODE_REVIEW)).toBe(true);
    });

    it('should grant ADMIN most permissions except those above their level', () => {
      expect(manager.hasPermission(TeamRole.ADMIN, Permission.PROJECT_VIEW)).toBe(true);
      expect(manager.hasPermission(TeamRole.ADMIN, Permission.PROJECT_EDIT)).toBe(true);
      expect(manager.hasPermission(TeamRole.ADMIN, Permission.PROJECT_DELETE)).toBe(true);
      expect(manager.hasPermission(TeamRole.ADMIN, Permission.PROJECT_DEPLOY)).toBe(true);
      expect(manager.hasPermission(TeamRole.ADMIN, Permission.TEAM_MANAGE)).toBe(true);
      expect(manager.hasPermission(TeamRole.ADMIN, Permission.COMMENT_CREATE)).toBe(true);
      expect(manager.hasPermission(TeamRole.ADMIN, Permission.COMMENT_DELETE)).toBe(true);
    });

    it('should grant EDITOR limited editing permissions', () => {
      expect(manager.hasPermission(TeamRole.EDITOR, Permission.PROJECT_VIEW)).toBe(true);
      expect(manager.hasPermission(TeamRole.EDITOR, Permission.PROJECT_EDIT)).toBe(true);
      expect(manager.hasPermission(TeamRole.EDITOR, Permission.COMMENT_CREATE)).toBe(true);
      expect(manager.hasPermission(TeamRole.EDITOR, Permission.CODE_REVIEW)).toBe(true);
    });

    it('should not grant EDITOR admin-level permissions', () => {
      expect(manager.hasPermission(TeamRole.EDITOR, Permission.PROJECT_DELETE)).toBe(false);
      expect(manager.hasPermission(TeamRole.EDITOR, Permission.PROJECT_DEPLOY)).toBe(false);
      expect(manager.hasPermission(TeamRole.EDITOR, Permission.TEAM_MANAGE)).toBe(false);
      expect(manager.hasPermission(TeamRole.EDITOR, Permission.COMMENT_DELETE)).toBe(false);
    });

    it('should grant VIEWER only PROJECT_VIEW permission', () => {
      expect(manager.hasPermission(TeamRole.VIEWER, Permission.PROJECT_VIEW)).toBe(true);
      expect(manager.hasPermission(TeamRole.VIEWER, Permission.PROJECT_EDIT)).toBe(false);
      expect(manager.hasPermission(TeamRole.VIEWER, Permission.COMMENT_CREATE)).toBe(false);
      expect(manager.hasPermission(TeamRole.VIEWER, Permission.CODE_REVIEW)).toBe(false);
    });
  });

  describe('getPermissions', () => {
    it('should return all permissions for OWNER', () => {
      const perms = manager.getPermissions(TeamRole.OWNER);
      expect(perms).toContain(Permission.PROJECT_VIEW);
      expect(perms).toContain(Permission.PROJECT_EDIT);
      expect(perms).toContain(Permission.PROJECT_DELETE);
      expect(perms).toContain(Permission.PROJECT_DEPLOY);
      expect(perms).toContain(Permission.TEAM_MANAGE);
      expect(perms).toContain(Permission.COMMENT_CREATE);
      expect(perms).toContain(Permission.COMMENT_DELETE);
      expect(perms).toContain(Permission.CODE_REVIEW);
    });

    it('should return only VIEW for VIEWER', () => {
      const perms = manager.getPermissions(TeamRole.VIEWER);
      expect(perms).toEqual([Permission.PROJECT_VIEW]);
    });
  });

  describe('canPerformAction', () => {
    it('should allow action when user has role-based permission', () => {
      const member: TeamMember = {
        userId: 'user-1',
        role: TeamRole.EDITOR,
        permissions: [],
        joinedAt: new Date(),
      };

      manager.addMember('project-1', member);

      expect(manager.canPerformAction('user-1', 'project-1', Permission.PROJECT_EDIT)).toBe(true);
    });

    it('should deny action when user lacks permission', () => {
      const member: TeamMember = {
        userId: 'user-1',
        role: TeamRole.VIEWER,
        permissions: [],
        joinedAt: new Date(),
      };

      manager.addMember('project-1', member);

      expect(manager.canPerformAction('user-1', 'project-1', Permission.PROJECT_EDIT)).toBe(false);
    });

    it('should allow action when user has explicit permission override', () => {
      const member: TeamMember = {
        userId: 'user-1',
        role: TeamRole.VIEWER,
        permissions: [Permission.COMMENT_CREATE],
        joinedAt: new Date(),
      };

      manager.addMember('project-1', member);

      expect(manager.canPerformAction('user-1', 'project-1', Permission.COMMENT_CREATE)).toBe(true);
    });

    it('should deny action for unknown user', () => {
      expect(manager.canPerformAction('unknown', 'project-1', Permission.PROJECT_VIEW)).toBe(false);
    });

    it('should deny action for unknown project', () => {
      expect(manager.canPerformAction('user-1', 'unknown-project', Permission.PROJECT_VIEW)).toBe(false);
    });
  });

  describe('getEffectivePermissions', () => {
    it('should combine role-based and explicit permissions', () => {
      const member: TeamMember = {
        userId: 'user-1',
        role: TeamRole.VIEWER,
        permissions: [Permission.COMMENT_CREATE, Permission.CODE_REVIEW],
        joinedAt: new Date(),
      };

      manager.addMember('project-1', member);

      const effective = manager.getEffectivePermissions('user-1', 'project-1');
      expect(effective).toContain(Permission.PROJECT_VIEW);
      expect(effective).toContain(Permission.COMMENT_CREATE);
      expect(effective).toContain(Permission.CODE_REVIEW);
    });

    it('should return empty for unknown user', () => {
      const effective = manager.getEffectivePermissions('unknown', 'project-1');
      expect(effective).toEqual([]);
    });
  });

  describe('member management', () => {
    it('should remove a member from a project', () => {
      const member: TeamMember = {
        userId: 'user-1',
        role: TeamRole.EDITOR,
        permissions: [],
        joinedAt: new Date(),
      };

      manager.addMember('project-1', member);
      expect(manager.canPerformAction('user-1', 'project-1', Permission.PROJECT_EDIT)).toBe(true);

      manager.removeMember('project-1', 'user-1');
      expect(manager.canPerformAction('user-1', 'project-1', Permission.PROJECT_EDIT)).toBe(false);
    });
  });
});

describe('RoleHierarchy', () => {
  it('should recognize OWNER as highest role', () => {
    expect(RoleHierarchy.isHigherOrEqual(TeamRole.OWNER, TeamRole.ADMIN)).toBe(true);
    expect(RoleHierarchy.isHigherOrEqual(TeamRole.OWNER, TeamRole.EDITOR)).toBe(true);
    expect(RoleHierarchy.isHigherOrEqual(TeamRole.OWNER, TeamRole.VIEWER)).toBe(true);
  });

  it('should recognize VIEWER as lowest role', () => {
    expect(RoleHierarchy.isHigherOrEqual(TeamRole.VIEWER, TeamRole.OWNER)).toBe(false);
    expect(RoleHierarchy.isHigherOrEqual(TeamRole.VIEWER, TeamRole.ADMIN)).toBe(false);
    expect(RoleHierarchy.isHigherOrEqual(TeamRole.VIEWER, TeamRole.EDITOR)).toBe(false);
    expect(RoleHierarchy.isHigherOrEqual(TeamRole.VIEWER, TeamRole.VIEWER)).toBe(true);
  });

  it('should return correct rank values', () => {
    expect(RoleHierarchy.getRank(TeamRole.OWNER)).toBeGreaterThan(RoleHierarchy.getRank(TeamRole.ADMIN));
    expect(RoleHierarchy.getRank(TeamRole.ADMIN)).toBeGreaterThan(RoleHierarchy.getRank(TeamRole.EDITOR));
    expect(RoleHierarchy.getRank(TeamRole.EDITOR)).toBeGreaterThan(RoleHierarchy.getRank(TeamRole.VIEWER));
  });
});
