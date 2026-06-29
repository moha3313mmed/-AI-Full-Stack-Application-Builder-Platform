import {
  PluginHook,
  PluginManifest,
  PluginStatus,
} from '../types/index.js';

import { HookExecutor } from './hook-executor.js';

export type LifecycleEventHandler = (event: LifecycleEvent) => void;

export interface LifecycleEvent {
  pluginId: string;
  previousStatus: PluginStatus;
  currentStatus: PluginStatus;
  hook?: PluginHook;
  timestamp: Date;
}

interface PluginState {
  manifest: PluginManifest;
  status: PluginStatus;
}

/**
 * PluginLifecycleManager manages plugin state transitions (install, activate,
 * deactivate, uninstall) with event emission and hook execution at each transition.
 *
 * State machine transitions:
 * - install: -> INSTALLED
 * - activate: INSTALLED | INACTIVE -> ACTIVE
 * - deactivate: ACTIVE -> INACTIVE
 * - uninstall: INSTALLED | INACTIVE | ERROR -> removed
 */
export class PluginLifecycleManager {
  private plugins: Map<string, PluginState> = new Map();
  private eventHandlers: LifecycleEventHandler[] = [];
  private hookExecutor: HookExecutor;

  constructor(hookExecutor?: HookExecutor) {
    this.hookExecutor = hookExecutor ?? new HookExecutor();
  }

  /**
   * Register an event handler for lifecycle events.
   */
  onEvent(handler: LifecycleEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Install a plugin. Sets status to INSTALLED and executes the onInstall hook.
   */
  async install(
    manifest: PluginManifest,
    hookFn?: () => Promise<void> | void,
  ): Promise<void> {
    if (this.plugins.has(manifest.id)) {
      throw new Error(`Plugin "${manifest.id}" is already installed`);
    }

    const state: PluginState = {
      manifest,
      status: PluginStatus.INSTALLED,
    };

    this.plugins.set(manifest.id, state);

    if (hookFn && manifest.hooks.includes(PluginHook.ON_INSTALL)) {
      const result = await this.hookExecutor.execute(manifest.id, PluginHook.ON_INSTALL, hookFn);
      if (!result.success) {
        state.status = PluginStatus.ERROR;
        this.emitEvent(manifest.id, PluginStatus.INSTALLED, PluginStatus.ERROR, PluginHook.ON_INSTALL);
        throw new Error(`Hook ON_INSTALL failed for plugin "${manifest.id}": ${result.error}`);
      }
    }

    this.emitEvent(manifest.id, PluginStatus.INACTIVE, PluginStatus.INSTALLED, PluginHook.ON_INSTALL);
  }

  /**
   * Activate a plugin. Transitions from INSTALLED or INACTIVE to ACTIVE.
   */
  async activate(
    pluginId: string,
    hookFn?: () => Promise<void> | void,
  ): Promise<void> {
    const state = this.getPluginState(pluginId);
    const validStates = [PluginStatus.INSTALLED, PluginStatus.INACTIVE];

    if (!validStates.includes(state.status)) {
      throw new Error(
        `Cannot activate plugin "${pluginId}": current status is "${state.status}". ` +
          `Must be one of: ${validStates.join(', ')}`,
      );
    }

    const previousStatus = state.status;

    if (hookFn && state.manifest.hooks.includes(PluginHook.ON_ACTIVATE)) {
      const result = await this.hookExecutor.execute(pluginId, PluginHook.ON_ACTIVATE, hookFn);
      if (!result.success) {
        state.status = PluginStatus.ERROR;
        this.emitEvent(pluginId, previousStatus, PluginStatus.ERROR, PluginHook.ON_ACTIVATE);
        throw new Error(`Hook ON_ACTIVATE failed for plugin "${pluginId}": ${result.error}`);
      }
    }

    state.status = PluginStatus.ACTIVE;
    this.emitEvent(pluginId, previousStatus, PluginStatus.ACTIVE, PluginHook.ON_ACTIVATE);
  }

  /**
   * Deactivate a plugin. Transitions from ACTIVE to INACTIVE.
   */
  async deactivate(
    pluginId: string,
    hookFn?: () => Promise<void> | void,
  ): Promise<void> {
    const state = this.getPluginState(pluginId);

    if (state.status !== PluginStatus.ACTIVE) {
      throw new Error(
        `Cannot deactivate plugin "${pluginId}": current status is "${state.status}". Must be "ACTIVE"`,
      );
    }

    const previousStatus = state.status;

    if (hookFn && state.manifest.hooks.includes(PluginHook.ON_DEACTIVATE)) {
      const result = await this.hookExecutor.execute(pluginId, PluginHook.ON_DEACTIVATE, hookFn);
      if (!result.success) {
        state.status = PluginStatus.ERROR;
        this.emitEvent(pluginId, previousStatus, PluginStatus.ERROR, PluginHook.ON_DEACTIVATE);
        throw new Error(`Hook ON_DEACTIVATE failed for plugin "${pluginId}": ${result.error}`);
      }
    }

    state.status = PluginStatus.INACTIVE;
    this.emitEvent(pluginId, previousStatus, PluginStatus.INACTIVE, PluginHook.ON_DEACTIVATE);
  }

  /**
   * Uninstall a plugin. Removes it from the manager entirely.
   */
  async uninstall(
    pluginId: string,
    hookFn?: () => Promise<void> | void,
  ): Promise<void> {
    const state = this.getPluginState(pluginId);
    const validStates = [PluginStatus.INSTALLED, PluginStatus.INACTIVE, PluginStatus.ERROR];

    if (!validStates.includes(state.status)) {
      throw new Error(
        `Cannot uninstall plugin "${pluginId}": current status is "${state.status}". ` +
          `Must be one of: ${validStates.join(', ')}`,
      );
    }

    const previousStatus = state.status;

    if (hookFn && state.manifest.hooks.includes(PluginHook.ON_UNINSTALL)) {
      const result = await this.hookExecutor.execute(pluginId, PluginHook.ON_UNINSTALL, hookFn);
      if (!result.success) {
        state.status = PluginStatus.ERROR;
        this.emitEvent(pluginId, previousStatus, PluginStatus.ERROR, PluginHook.ON_UNINSTALL);
        throw new Error(`Hook ON_UNINSTALL failed for plugin "${pluginId}": ${result.error}`);
      }
    }

    this.plugins.delete(pluginId);
    this.emitEvent(pluginId, previousStatus, PluginStatus.INACTIVE, PluginHook.ON_UNINSTALL);
  }

  /**
   * Get the current status of a plugin.
   */
  getStatus(pluginId: string): PluginStatus {
    return this.getPluginState(pluginId).status;
  }

  /**
   * Get all managed plugins.
   */
  listPlugins(): Array<{ id: string; status: PluginStatus; manifest: PluginManifest }> {
    return Array.from(this.plugins.entries()).map(([id, state]) => ({
      id,
      status: state.status,
      manifest: state.manifest,
    }));
  }

  private getPluginState(pluginId: string): PluginState {
    const state = this.plugins.get(pluginId);
    if (!state) {
      throw new Error(`Plugin "${pluginId}" is not installed`);
    }
    return state;
  }

  private emitEvent(
    pluginId: string,
    previousStatus: PluginStatus,
    currentStatus: PluginStatus,
    hook?: PluginHook,
  ): void {
    const event: LifecycleEvent = {
      pluginId,
      previousStatus,
      currentStatus,
      hook,
      timestamp: new Date(),
    };
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }
}
