import { PluginPermission } from '../types/index.js';

/**
 * Error thrown when a plugin attempts an operation without the required permission.
 */
export class PermissionDeniedError extends Error {
  public readonly pluginId: string;
  public readonly requiredPermission: PluginPermission;
  public readonly operation: string;

  constructor(pluginId: string, requiredPermission: PluginPermission, operation: string) {
    super(
      `Plugin "${pluginId}" does not have permission "${requiredPermission}" required for operation "${operation}"`,
    );
    this.name = 'PermissionDeniedError';
    this.pluginId = pluginId;
    this.requiredPermission = requiredPermission;
    this.operation = operation;
  }
}

/**
 * PermissionGuard checks if a plugin has the required permission for an operation.
 * Throws PermissionDeniedError if not authorized.
 */
export class PermissionGuard {
  private pluginPermissions: Map<string, Set<PluginPermission>> = new Map();

  /**
   * Register the permissions a plugin has been granted.
   */
  registerPlugin(pluginId: string, permissions: PluginPermission[]): void {
    this.pluginPermissions.set(pluginId, new Set(permissions));
  }

  /**
   * Remove a plugin's permissions.
   */
  unregisterPlugin(pluginId: string): void {
    this.pluginPermissions.delete(pluginId);
  }

  /**
   * Check if a plugin has a specific permission.
   * Throws PermissionDeniedError if the plugin does not have the required permission.
   */
  checkPermission(
    pluginId: string,
    requiredPermission: PluginPermission,
    operation: string,
  ): void {
    const permissions = this.pluginPermissions.get(pluginId);

    if (!permissions) {
      throw new PermissionDeniedError(pluginId, requiredPermission, operation);
    }

    if (!permissions.has(requiredPermission)) {
      throw new PermissionDeniedError(pluginId, requiredPermission, operation);
    }
  }

  /**
   * Check if a plugin has a specific permission without throwing.
   * Returns true if the plugin has the permission.
   */
  hasPermission(pluginId: string, permission: PluginPermission): boolean {
    const permissions = this.pluginPermissions.get(pluginId);
    if (!permissions) return false;
    return permissions.has(permission);
  }

  /**
   * Get all permissions for a plugin.
   */
  getPermissions(pluginId: string): PluginPermission[] {
    const permissions = this.pluginPermissions.get(pluginId);
    if (!permissions) return [];
    return Array.from(permissions);
  }
}
