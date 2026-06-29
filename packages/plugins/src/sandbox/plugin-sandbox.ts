import { PluginContext, PluginPermission, PluginManifest } from '../types/index.js';

import { PermissionDeniedError, PermissionGuard } from './permission-guard.js';

export interface SandboxOptions {
  /** Timeout for operations in milliseconds. Default: 10000 */
  timeout: number;
}

export interface SandboxFileOperation {
  type: 'read' | 'write';
  path: string;
  content?: string;
}

export interface SandboxNetworkOperation {
  type: 'fetch';
  url: string;
  method?: string;
}

/**
 * PluginSandbox provides a permission-mediated execution environment for plugin code.
 *
 * ## Trust Model
 *
 * This is NOT an isolated execution sandbox. Plugin code runs in the same Node.js
 * process and V8 context as the host application. The "sandbox" provides:
 *
 * 1. **Permission-mediated API access**: Operations like readFile, writeFile, fetch,
 *    and callAI are gated by the PermissionGuard, which checks the plugin's declared
 *    permissions before allowing the operation.
 *
 * 2. **Timeout protection**: The executeInSandbox method wraps execution with a
 *    configurable timeout to prevent unbounded wall-clock time.
 *
 * 3. **Path validation**: File operations through the mediated API reject path
 *    traversal attempts (relative paths with ".." or absolute paths).
 *
 * ## Limitations
 *
 * Plugin code retains full access to Node.js APIs (require, process, fs, net, etc.)
 * and can bypass the mediated API entirely. The permission checks only apply to
 * operations routed through this class. This design assumes plugins are
 * semi-trusted (e.g., reviewed before publication) rather than fully untrusted.
 *
 * For true isolation, a separate process, worker thread with restricted permissions,
 * or a WASM-based sandbox would be required.
 */
export class PluginSandbox {
  private permissionGuard: PermissionGuard;
  private timeout: number;
  private fileOperations: SandboxFileOperation[] = [];
  private networkOperations: SandboxNetworkOperation[] = [];

  constructor(permissionGuard: PermissionGuard, options?: Partial<SandboxOptions>) {
    this.permissionGuard = permissionGuard;
    this.timeout = options?.timeout ?? 10000;
  }

  /**
   * Create a sandboxed context for a plugin with permission-checked operations.
   */
  createContext(manifest: PluginManifest): PluginContext {
    const pluginId = manifest.id;

    return {
      pluginId,
      workspaceRoot: '/workspace',
      pluginDataDir: `/workspace/.plugins/${pluginId}`,
      config: {},
      logger: {
        info: (message: string) => this.log(pluginId, 'info', message),
        warn: (message: string) => this.log(pluginId, 'warn', message),
        error: (message: string) => this.log(pluginId, 'error', message),
        debug: (message: string) => this.log(pluginId, 'debug', message),
      },
    };
  }

  /**
   * Execute a file read operation within the sandbox.
   * Requires READ_FILES permission.
   */
  readFile(pluginId: string, path: string): string {
    this.permissionGuard.checkPermission(pluginId, PluginPermission.READ_FILES, 'readFile');
    this.validatePath(path);

    const operation: SandboxFileOperation = { type: 'read', path };
    this.fileOperations.push(operation);

    return `[sandboxed read: ${path}]`;
  }

  /**
   * Execute a file write operation within the sandbox.
   * Requires WRITE_FILES permission.
   */
  writeFile(pluginId: string, path: string, content: string): void {
    this.permissionGuard.checkPermission(pluginId, PluginPermission.WRITE_FILES, 'writeFile');
    this.validatePath(path);

    const operation: SandboxFileOperation = { type: 'write', path, content };
    this.fileOperations.push(operation);
  }

  /**
   * Execute a network operation within the sandbox.
   * Requires NETWORK permission.
   */
  fetch(pluginId: string, url: string, method: string = 'GET'): string {
    this.permissionGuard.checkPermission(pluginId, PluginPermission.NETWORK, 'fetch');

    const operation: SandboxNetworkOperation = { type: 'fetch', url, method };
    this.networkOperations.push(operation);

    return `[sandboxed fetch: ${method} ${url}]`;
  }

  /**
   * Execute an AI call within the sandbox.
   * Requires AI_ACCESS permission.
   */
  callAI(pluginId: string, prompt: string): string {
    this.permissionGuard.checkPermission(pluginId, PluginPermission.AI_ACCESS, 'callAI');
    return `[sandboxed AI call: ${prompt.substring(0, 50)}...]`;
  }

  /**
   * Execute a function within the sandbox with timeout protection.
   */
  async executeInSandbox<T>(
    _pluginId: string,
    fn: () => Promise<T> | T,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Sandbox execution timed out after ${this.timeout}ms`));
      }, this.timeout);

      try {
        const result = fn();
        if (result && typeof result === 'object' && 'then' in result) {
          (result as Promise<T>)
            .then((value) => {
              clearTimeout(timer);
              resolve(value);
            })
            .catch((error: unknown) => {
              clearTimeout(timer);
              reject(error);
            });
        } else {
          clearTimeout(timer);
          resolve(result as T);
        }
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /**
   * Get the recorded file operations.
   */
  getFileOperations(): SandboxFileOperation[] {
    return [...this.fileOperations];
  }

  /**
   * Get the recorded network operations.
   */
  getNetworkOperations(): SandboxNetworkOperation[] {
    return [...this.networkOperations];
  }

  /**
   * Get the timeout value.
   */
  getTimeout(): number {
    return this.timeout;
  }

  /**
   * Reset all tracked operations.
   */
  reset(): void {
    this.fileOperations = [];
    this.networkOperations = [];
  }

  private log(pluginId: string, level: string, message: string): void {
    // In production, this would forward to a logging system
    void pluginId;
    void level;
    void message;
  }

  private validatePath(path: string): void {
    // Prevent path traversal attacks
    if (path.includes('..') || path.startsWith('/')) {
      throw new Error(`Invalid path: "${path}". Paths must be relative and cannot contain ".."`)
    }
  }
}

export { PermissionDeniedError };
