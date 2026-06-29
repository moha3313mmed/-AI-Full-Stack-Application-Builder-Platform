import { ModelNotFoundError } from './errors.js';
import type { ProviderRegistry } from './registry.js';
import type { AICompletionRequest, AICompletionResponse } from './types/index.js';

export interface RouteRule {
  pattern: RegExp;
  provider: string;
}

/**
 * ModelRouter routes completion requests to the appropriate AI provider
 * based on model name prefixes and custom routing rules.
 */
export class ModelRouter {
  private rules: RouteRule[] = [];
  private registry: ProviderRegistry;

  constructor(registry: ProviderRegistry) {
    this.registry = registry;

    // Default routing rules based on model name prefixes
    this.rules = [
      { pattern: /^gpt-/, provider: 'openai' },
      { pattern: /^o\d/, provider: 'openai' },
      { pattern: /^claude-/, provider: 'anthropic' },
      { pattern: /^gemini-/, provider: 'gemini' },
    ];
  }

  /**
   * Add a custom routing rule. Rules are evaluated in order, first match wins.
   */
  addRule(pattern: RegExp, provider: string): void {
    this.rules.unshift({ pattern, provider });
  }

  /**
   * Remove all rules matching a given provider.
   */
  removeRulesForProvider(provider: string): void {
    this.rules = this.rules.filter((rule) => rule.provider !== provider);
  }

  /**
   * Resolve which provider should handle a given model name.
   */
  resolve(model: string): string | undefined {
    for (const rule of this.rules) {
      if (rule.pattern.test(model)) {
        return rule.provider;
      }
    }
    return undefined;
  }

  /**
   * Route a completion request to the appropriate provider and execute it.
   */
  async route(request: AICompletionRequest): Promise<AICompletionResponse> {
    const providerName = this.resolve(request.model);
    if (!providerName) {
      throw new ModelNotFoundError(
        'router',
        request.model
      );
    }

    const provider = this.registry.getWithFallback(providerName);
    if (!provider) {
      throw new ModelNotFoundError(
        providerName,
        request.model
      );
    }

    return provider.complete(request);
  }

  /**
   * Route a streaming request to the appropriate provider.
   */
  routeStream(request: AICompletionRequest) {
    const providerName = this.resolve(request.model);
    if (!providerName) {
      throw new ModelNotFoundError(
        'router',
        request.model
      );
    }

    const provider = this.registry.getWithFallback(providerName);
    if (!provider) {
      throw new ModelNotFoundError(
        providerName,
        request.model
      );
    }

    return provider.stream(request);
  }

  /**
   * List all routing rules.
   */
  listRules(): RouteRule[] {
    return [...this.rules];
  }
}
