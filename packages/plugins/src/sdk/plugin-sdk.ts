import { PermissionGuard, PermissionDeniedError } from '../sandbox/permission-guard.js';
import {
  PluginContext,
  PluginHook,
  PluginManifest,
  PluginPermission,
} from '../types/index.js';

export type HookHandler = (context: PluginContext, data?: unknown) => Promise<void> | void;

interface RegisteredHook {
  hook: PluginHook;
  handler: HookHandler;
}

/**
 * PluginSDK provides the API surface available to plugin authors.
 * Each method checks permissions via PermissionGuard.
 */
export class PluginSDK {
  private permissionGuard: PermissionGuard;
  private manifest: PluginManifest;
  private context: PluginContext;
  private registeredHooks: RegisteredHook[] = [];
  private logs: Array<{ level: string; message: string; timestamp: Date }> = [];

  constructor(manifest: PluginManifest, permissionGuard: PermissionGuard, context: PluginContext) {
    this.manifest = manifest;
    this.permissionGuard = permissionGuard;
    this.context = context;
  }

  /**
   * Register a hook handler for a specific hook.
   */
  registerHook(hook: PluginHook, handler: HookHandler): void {
    if (!this.manifest.hooks.includes(hook)) {
      throw new Error(
        `Plugin "${this.manifest.id}" has not declared hook "${hook}" in its manifest`,
      );
    }

    this.registeredHooks.push({ hook, handler });
  }

  /**
   * Get the current plugin context.
   */
  getContext(): PluginContext {
    return { ...this.context };
  }

  /**
   * Read a file. Requires READ_FILES permission.
   */
  readFile(path: string): string {
    this.permissionGuard.checkPermission(
      this.manifest.id,
      PluginPermission.READ_FILES,
      'readFile',
    );
    return `[sdk read: ${path}]`;
  }

  /**
   * Write a file. Requires WRITE_FILES permission.
   */
  writeFile(path: string, content: string): void {
    this.permissionGuard.checkPermission(
      this.manifest.id,
      PluginPermission.WRITE_FILES,
      'writeFile',
    );
    void path;
    void content;
  }

  /**
   * Call an AI model. Requires AI_ACCESS permission.
   */
  callAI(prompt: string): string {
    this.permissionGuard.checkPermission(
      this.manifest.id,
      PluginPermission.AI_ACCESS,
      'callAI',
    );
    return `[sdk AI response for: ${prompt.substring(0, 50)}]`;
  }

  /**
   * Log a message.
   */
  log(level: 'info' | 'warn' | 'error' | 'debug', message: string): void {
    this.logs.push({ level, message, timestamp: new Date() });
  }

  /**
   * Get all registered hooks.
   */
  getRegisteredHooks(): RegisteredHook[] {
    return [...this.registeredHooks];
  }

  /**
   * Get all logged messages.
   */
  getLogs(): Array<{ level: string; message: string; timestamp: Date }> {
    return [...this.logs];
  }

  /**
   * Get the plugin manifest.
   */
  getManifest(): PluginManifest {
    return { ...this.manifest };
  }
}

export { PermissionDeniedError };
