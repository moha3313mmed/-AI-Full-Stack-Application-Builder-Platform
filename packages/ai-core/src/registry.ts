import type { AIProvider } from './types/index.js';

/**
 * ProviderRegistry manages AI provider instances.
 * Supports dynamic registration, retrieval, and health checks.
 */
export class ProviderRegistry {
  private providers = new Map<string, AIProvider>();
  private fallbackChains = new Map<string, string[]>();

  /**
   * Register a provider by name.
   */
  register(name: string, provider: AIProvider): void {
    this.providers.set(name, provider);
  }

  /**
   * Unregister a provider by name.
   */
  unregister(name: string): boolean {
    return this.providers.delete(name);
  }

  /**
   * Retrieve a provider by name.
   */
  get(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Check if a provider is registered.
   */
  has(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * List all registered provider names.
   */
  list(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Perform a health check on a provider by attempting to list its models.
   */
  async healthCheck(name: string): Promise<boolean> {
    const provider = this.providers.get(name);
    if (!provider) return false;
    try {
      const models = await provider.listModels();
      return models.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Perform health checks on all registered providers.
   */
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const checks = Array.from(this.providers.keys()).map(async (name) => {
      const healthy = await this.healthCheck(name);
      results.set(name, healthy);
    });
    await Promise.all(checks);
    return results;
  }

  /**
   * Set a fallback chain for a provider.
   * If the primary provider fails, the system will try the fallback providers in order.
   */
  setFallbackChain(primaryProvider: string, fallbacks: string[]): void {
    this.fallbackChains.set(primaryProvider, fallbacks);
  }

  /**
   * Get the fallback chain for a provider.
   */
  getFallbackChain(provider: string): string[] {
    return this.fallbackChains.get(provider) ?? [];
  }

  /**
   * Get a provider with fallback support.
   * Returns the primary provider if available, or the first available fallback.
   */
  getWithFallback(name: string): AIProvider | undefined {
    const primary = this.providers.get(name);
    if (primary) return primary;

    const fallbacks = this.fallbackChains.get(name) ?? [];
    for (const fallback of fallbacks) {
      const provider = this.providers.get(fallback);
      if (provider) return provider;
    }

    return undefined;
  }

  /**
   * Clear all registered providers.
   */
  clear(): void {
    this.providers.clear();
    this.fallbackChains.clear();
  }
}
