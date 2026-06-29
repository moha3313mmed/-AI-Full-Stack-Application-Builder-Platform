import { PluginHook, PluginManifest, PluginStatus } from '../types/index.js';

export interface RegisteredPlugin {
  manifest: PluginManifest;
  status: PluginStatus;
  installedAt: Date;
  updatedAt: Date;
}

/**
 * PluginRegistry manages installed plugins. Supports register, unregister,
 * get, list, and findByHook operations.
 */
export class PluginRegistry {
  private plugins: Map<string, RegisteredPlugin> = new Map();

  /**
   * Register a plugin in the registry.
   */
  register(manifest: PluginManifest): RegisteredPlugin {
    if (this.plugins.has(manifest.id)) {
      throw new Error(
        `Plugin "${manifest.id}" is already registered. Use update() to modify an existing plugin.`,
      );
    }

    const now = new Date();
    const entry: RegisteredPlugin = {
      manifest,
      status: PluginStatus.INSTALLED,
      installedAt: now,
      updatedAt: now,
    };

    this.plugins.set(manifest.id, entry);
    return entry;
  }

  /**
   * Unregister a plugin from the registry.
   */
  unregister(pluginId: string): boolean {
    if (!this.plugins.has(pluginId)) {
      throw new Error(`Plugin "${pluginId}" is not registered`);
    }
    return this.plugins.delete(pluginId);
  }

  /**
   * Get a registered plugin by ID.
   * Throws if the plugin is not found.
   */
  get(pluginId: string): RegisteredPlugin {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(
        `Plugin "${pluginId}" is not registered. Available plugins: ${this.listIds().join(', ') || 'none'}`,
      );
    }
    return plugin;
  }

  /**
   * Check if a plugin is registered.
   */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * List all registered plugins.
   */
  list(): RegisteredPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * List all registered plugin IDs.
   */
  listIds(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Find all plugins registered for a specific hook.
   */
  findByHook(hook: PluginHook): RegisteredPlugin[] {
    return this.list().filter((plugin) => plugin.manifest.hooks.includes(hook));
  }

  /**
   * Find plugins by status.
   */
  findByStatus(status: PluginStatus): RegisteredPlugin[] {
    return this.list().filter((plugin) => plugin.status === status);
  }

  /**
   * Update a plugin's status.
   */
  updateStatus(pluginId: string, status: PluginStatus): void {
    const plugin = this.get(pluginId);
    plugin.status = status;
    plugin.updatedAt = new Date();
  }

  /**
   * Get the count of registered plugins.
   */
  count(): number {
    return this.plugins.size;
  }

  /**
   * Clear all registered plugins.
   */
  clear(): void {
    this.plugins.clear();
  }
}
