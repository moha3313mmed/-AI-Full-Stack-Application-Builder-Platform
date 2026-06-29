import { DeploymentProvider } from '../types/index.js';

import { BaseDeployProvider } from './base-provider.js';

export type ProviderFactory = () => BaseDeployProvider;

/**
 * ProviderRegistry manages available deployment providers using the strategy pattern.
 * Allows registration of provider factories and retrieval by DeploymentProvider enum.
 */
export class ProviderRegistry {
  private providers: Map<DeploymentProvider, ProviderFactory> = new Map();

  /**
   * Register a provider factory for a given DeploymentProvider.
   */
  register(provider: DeploymentProvider, factory: ProviderFactory): void {
    this.providers.set(provider, factory);
  }

  /**
   * Get an instance of the provider for the given DeploymentProvider enum.
   * Throws if the provider is not registered.
   */
  get(provider: DeploymentProvider): BaseDeployProvider {
    const factory = this.providers.get(provider);
    if (!factory) {
      throw new Error(
        `Provider "${provider}" is not registered. Available providers: ${this.listAvailable().join(', ')}`,
      );
    }
    return factory();
  }

  /**
   * Check if a provider is registered.
   */
  has(provider: DeploymentProvider): boolean {
    return this.providers.has(provider);
  }

  /**
   * List all registered (available) deployment providers.
   */
  listAvailable(): DeploymentProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Remove a provider from the registry.
   */
  unregister(provider: DeploymentProvider): boolean {
    return this.providers.delete(provider);
  }

  /**
   * Clear all registered providers.
   */
  clear(): void {
    this.providers.clear();
  }
}
