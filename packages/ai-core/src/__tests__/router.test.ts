import { describe, it, expect, beforeEach } from 'vitest';

import { ModelNotFoundError } from '../errors.js';
import { ProviderRegistry } from '../registry.js';
import { ModelRouter } from '../router.js';
import type { AIProvider, AICompletionRequest } from '../types/index.js';

function createMockProvider(name: string): AIProvider {
  return {
    name,
    complete: async (request) => ({
      content: `Response from ${name}`,
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      model: request.model,
      finishReason: 'stop' as const,
    }),
    stream: async function* () {
      yield { delta: 'test' };
    },
    countTokens: async () => 10,
    listModels: async () => [`${name}-model-1`],
  };
}

describe('ModelRouter', () => {
  let registry: ProviderRegistry;
  let router: ModelRouter;

  beforeEach(() => {
    registry = new ProviderRegistry();
    registry.register('openai', createMockProvider('openai'));
    registry.register('anthropic', createMockProvider('anthropic'));
    registry.register('gemini', createMockProvider('gemini'));
    router = new ModelRouter(registry);
  });

  describe('resolve', () => {
    it('should route gpt-* models to openai', () => {
      expect(router.resolve('gpt-4')).toBe('openai');
      expect(router.resolve('gpt-4-turbo')).toBe('openai');
      expect(router.resolve('gpt-3.5-turbo')).toBe('openai');
    });

    it('should route claude-* models to anthropic', () => {
      expect(router.resolve('claude-3-5-sonnet-20241022')).toBe('anthropic');
      expect(router.resolve('claude-3-opus-20240229')).toBe('anthropic');
      expect(router.resolve('claude-3-haiku-20240307')).toBe('anthropic');
    });

    it('should route gemini-* models to gemini', () => {
      expect(router.resolve('gemini-pro')).toBe('gemini');
      expect(router.resolve('gemini-ultra')).toBe('gemini');
      expect(router.resolve('gemini-1.5-pro')).toBe('gemini');
    });

    it('should route o-series models to openai', () => {
      expect(router.resolve('o1-preview')).toBe('openai');
      expect(router.resolve('o1-mini')).toBe('openai');
    });

    it('should return undefined for unknown model', () => {
      expect(router.resolve('unknown-model')).toBeUndefined();
    });
  });

  describe('addRule', () => {
    it('should add a custom rule that takes priority', () => {
      router.addRule(/^custom-/, 'anthropic');
      expect(router.resolve('custom-model')).toBe('anthropic');
    });

    it('should override default rules when custom rule matches first', () => {
      router.addRule(/^gpt-/, 'anthropic');
      expect(router.resolve('gpt-4')).toBe('anthropic');
    });
  });

  describe('removeRulesForProvider', () => {
    it('should remove all rules for a given provider', () => {
      router.removeRulesForProvider('openai');
      expect(router.resolve('gpt-4')).toBeUndefined();
    });
  });

  describe('route', () => {
    it('should route request to the correct provider', async () => {
      const request: AICompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4',
      };

      const response = await router.route(request);
      expect(response.content).toBe('Response from openai');
      expect(response.model).toBe('gpt-4');
    });

    it('should throw ModelNotFoundError for unknown model', async () => {
      const request: AICompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'unknown-model',
      };

      await expect(router.route(request)).rejects.toThrow(ModelNotFoundError);
    });

    it('should throw when provider is not registered', async () => {
      registry.unregister('openai');
      const request: AICompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4',
      };

      await expect(router.route(request)).rejects.toThrow(ModelNotFoundError);
    });
  });

  describe('routeStream', () => {
    it('should route stream request to the correct provider', async () => {
      const request: AICompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
      };

      const stream = router.routeStream(request);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should throw ModelNotFoundError for unknown model', () => {
      const request: AICompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'unknown-model',
      };

      expect(() => router.routeStream(request)).toThrow(ModelNotFoundError);
    });
  });

  describe('listRules', () => {
    it('should list all routing rules', () => {
      const rules = router.listRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some((r) => r.provider === 'openai')).toBe(true);
      expect(rules.some((r) => r.provider === 'anthropic')).toBe(true);
      expect(rules.some((r) => r.provider === 'gemini')).toBe(true);
    });
  });
});
