import { describe, it, expect, beforeEach } from 'vitest';

import { ProviderRegistry } from '../registry.js';
import type { AIProvider } from '../types/index.js';

function createMockProvider(name: string): AIProvider {
  return {
    name,
    complete: async () => ({
      content: 'test',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      model: 'test-model',
      finishReason: 'stop' as const,
    }),
    stream: async function* () {
      yield { delta: 'test' };
    },
    countTokens: async () => 10,
    listModels: async () => ['model-a', 'model-b'],
  };
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it('should register and retrieve a provider', () => {
    const provider = createMockProvider('openai');
    registry.register('openai', provider);

    expect(registry.get('openai')).toBe(provider);
    expect(registry.has('openai')).toBe(true);
  });

  it('should return undefined for unregistered provider', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
    expect(registry.has('nonexistent')).toBe(false);
  });

  it('should list registered providers', () => {
    registry.register('openai', createMockProvider('openai'));
    registry.register('anthropic', createMockProvider('anthropic'));

    const list = registry.list();
    expect(list).toContain('openai');
    expect(list).toContain('anthropic');
    expect(list).toHaveLength(2);
  });

  it('should unregister a provider', () => {
    registry.register('openai', createMockProvider('openai'));
    expect(registry.has('openai')).toBe(true);

    const result = registry.unregister('openai');
    expect(result).toBe(true);
    expect(registry.has('openai')).toBe(false);
  });

  it('should return false when unregistering nonexistent provider', () => {
    const result = registry.unregister('nonexistent');
    expect(result).toBe(false);
  });

  it('should perform health check on a provider', async () => {
    registry.register('openai', createMockProvider('openai'));
    const healthy = await registry.healthCheck('openai');
    expect(healthy).toBe(true);
  });

  it('should return false for health check on nonexistent provider', async () => {
    const healthy = await registry.healthCheck('nonexistent');
    expect(healthy).toBe(false);
  });

  it('should return false for health check when provider throws', async () => {
    const failingProvider: AIProvider = {
      name: 'failing',
      complete: async () => {
        throw new Error('fail');
      },
      // eslint-disable-next-line require-yield
      stream: async function* () {
        throw new Error('fail');
      },
      countTokens: async () => {
        throw new Error('fail');
      },
      listModels: async () => {
        throw new Error('fail');
      },
    };
    registry.register('failing', failingProvider);
    const healthy = await registry.healthCheck('failing');
    expect(healthy).toBe(false);
  });

  it('should perform health check on all providers', async () => {
    registry.register('openai', createMockProvider('openai'));
    registry.register('anthropic', createMockProvider('anthropic'));

    const results = await registry.healthCheckAll();
    expect(results.get('openai')).toBe(true);
    expect(results.get('anthropic')).toBe(true);
  });

  it('should support fallback chains', () => {
    registry.register('openai', createMockProvider('openai'));
    registry.register('anthropic', createMockProvider('anthropic'));
    registry.setFallbackChain('openai', ['anthropic']);

    const chain = registry.getFallbackChain('openai');
    expect(chain).toEqual(['anthropic']);
  });

  it('should get provider with fallback when primary is missing', () => {
    const anthropicProvider = createMockProvider('anthropic');
    registry.register('anthropic', anthropicProvider);
    registry.setFallbackChain('openai', ['anthropic']);

    const provider = registry.getWithFallback('openai');
    expect(provider).toBe(anthropicProvider);
  });

  it('should return primary provider when available', () => {
    const openaiProvider = createMockProvider('openai');
    registry.register('openai', openaiProvider);
    registry.register('anthropic', createMockProvider('anthropic'));
    registry.setFallbackChain('openai', ['anthropic']);

    const provider = registry.getWithFallback('openai');
    expect(provider).toBe(openaiProvider);
  });

  it('should return undefined when no fallback available', () => {
    const provider = registry.getWithFallback('nonexistent');
    expect(provider).toBeUndefined();
  });

  it('should clear all providers', () => {
    registry.register('openai', createMockProvider('openai'));
    registry.register('anthropic', createMockProvider('anthropic'));
    registry.setFallbackChain('openai', ['anthropic']);

    registry.clear();
    expect(registry.list()).toHaveLength(0);
    expect(registry.getFallbackChain('openai')).toEqual([]);
  });
});
