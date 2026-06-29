import { describe, it, expect, beforeEach } from 'vitest';

import { NetlifyProvider } from '../providers/netlify-provider.js';
import { ProviderRegistry } from '../providers/provider-registry.js';
import { VercelProvider } from '../providers/vercel-provider.js';
import { DeploymentProvider } from '../types/index.js';

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it('should register and retrieve a provider', () => {
    registry.register(DeploymentProvider.VERCEL, () => new VercelProvider({ token: 'test-token' }));

    const provider = registry.get(DeploymentProvider.VERCEL);

    expect(provider).toBeInstanceOf(VercelProvider);
  });

  it('should register multiple providers', () => {
    registry.register(DeploymentProvider.VERCEL, () => new VercelProvider({ token: 'test-token' }));
    registry.register(DeploymentProvider.NETLIFY, () => new NetlifyProvider());

    expect(registry.get(DeploymentProvider.VERCEL)).toBeInstanceOf(VercelProvider);
    expect(registry.get(DeploymentProvider.NETLIFY)).toBeInstanceOf(NetlifyProvider);
  });

  it('should throw when getting an unregistered provider', () => {
    expect(() => registry.get(DeploymentProvider.AWS)).toThrow(
      'Provider "AWS" is not registered',
    );
  });

  it('should list available providers', () => {
    registry.register(DeploymentProvider.VERCEL, () => new VercelProvider({ token: 'test-token' }));
    registry.register(DeploymentProvider.NETLIFY, () => new NetlifyProvider());

    const available = registry.listAvailable();

    expect(available).toContain(DeploymentProvider.VERCEL);
    expect(available).toContain(DeploymentProvider.NETLIFY);
    expect(available).toHaveLength(2);
  });

  it('should return empty list when no providers are registered', () => {
    const available = registry.listAvailable();

    expect(available).toHaveLength(0);
  });

  it('should check if a provider is registered with has()', () => {
    registry.register(DeploymentProvider.VERCEL, () => new VercelProvider({ token: 'test-token' }));

    expect(registry.has(DeploymentProvider.VERCEL)).toBe(true);
    expect(registry.has(DeploymentProvider.AWS)).toBe(false);
  });

  it('should unregister a provider', () => {
    registry.register(DeploymentProvider.VERCEL, () => new VercelProvider({ token: 'test-token' }));
    expect(registry.has(DeploymentProvider.VERCEL)).toBe(true);

    const result = registry.unregister(DeploymentProvider.VERCEL);

    expect(result).toBe(true);
    expect(registry.has(DeploymentProvider.VERCEL)).toBe(false);
  });

  it('should return false when unregistering a non-existent provider', () => {
    const result = registry.unregister(DeploymentProvider.AWS);

    expect(result).toBe(false);
  });

  it('should clear all providers', () => {
    registry.register(DeploymentProvider.VERCEL, () => new VercelProvider({ token: 'test-token' }));
    registry.register(DeploymentProvider.NETLIFY, () => new NetlifyProvider());

    registry.clear();

    expect(registry.listAvailable()).toHaveLength(0);
  });

  it('should create new instances on each get() call', () => {
    registry.register(DeploymentProvider.VERCEL, () => new VercelProvider({ token: 'test-token' }));

    const instance1 = registry.get(DeploymentProvider.VERCEL);
    const instance2 = registry.get(DeploymentProvider.VERCEL);

    expect(instance1).not.toBe(instance2);
  });

  it('should include available providers in error message', () => {
    registry.register(DeploymentProvider.VERCEL, () => new VercelProvider({ token: 'test-token' }));

    expect(() => registry.get(DeploymentProvider.AWS)).toThrow('VERCEL');
  });
});
