import { PluginExecutionResult, PluginHook } from '../types/index.js';

export interface HookExecutorOptions {
  /** Timeout in milliseconds for hook execution. Default: 5000 */
  timeout: number;
}

/**
 * HookExecutor safely executes plugin hooks with timeout protection,
 * error catching, and result reporting.
 */
export class HookExecutor {
  private defaultTimeout: number;

  constructor(options?: Partial<HookExecutorOptions>) {
    this.defaultTimeout = options?.timeout ?? 5000;
  }

  /**
   * Execute a hook function with timeout protection.
   * Throws if the hook times out or throws an error.
   */
  async execute(
    pluginId: string,
    hook: PluginHook,
    fn: () => Promise<void> | void,
    timeout?: number,
  ): Promise<PluginExecutionResult> {
    const effectiveTimeout = timeout ?? this.defaultTimeout;
    const startTime = Date.now();

    try {
      await this.executeWithTimeout(fn, effectiveTimeout);
      const duration = Date.now() - startTime;

      return {
        success: true,
        hook,
        pluginId,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown hook execution error';

      return {
        success: false,
        hook,
        pluginId,
        duration,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute a hook safely, returning the result without throwing.
   */
  async executeSafe(
    pluginId: string,
    hook: PluginHook,
    fn: () => Promise<void> | void,
    timeout?: number,
  ): Promise<PluginExecutionResult> {
    return this.execute(pluginId, hook, fn, timeout);
  }

  private executeWithTimeout(
    fn: () => Promise<void> | void,
    timeout: number,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Hook execution timed out after ${timeout}ms`));
      }, timeout);

      try {
        const result = fn();
        if (result && typeof result === 'object' && 'then' in result) {
          (result as Promise<void>)
            .then(() => {
              clearTimeout(timer);
              resolve();
            })
            .catch((error: unknown) => {
              clearTimeout(timer);
              reject(error);
            });
        } else {
          clearTimeout(timer);
          resolve();
        }
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }
}
