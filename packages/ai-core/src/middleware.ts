import type {
  AICompletionRequest,
  AICompletionResponse,
  MiddlewareContext,
  MiddlewareFn,
} from './types/index.js';

/**
 * MiddlewareChain processes requests and responses through a chain of middleware functions.
 * Middleware is executed in the order it is added (first added = outermost wrapper).
 */
export class MiddlewareChain {
  private middlewares: Array<{ name: string; fn: MiddlewareFn }> = [];

  /**
   * Add a middleware to the chain.
   */
  use(name: string, fn: MiddlewareFn): void {
    this.middlewares.push({ name, fn });
  }

  /**
   * Remove a middleware by name.
   */
  remove(name: string): boolean {
    const index = this.middlewares.findIndex((m) => m.name === name);
    if (index === -1) return false;
    this.middlewares.splice(index, 1);
    return true;
  }

  /**
   * Execute the middleware chain with a core handler.
   */
  async execute(
    request: AICompletionRequest,
    provider: string,
    handler: (request: AICompletionRequest) => Promise<AICompletionResponse>
  ): Promise<AICompletionResponse> {
    const context: MiddlewareContext = {
      request,
      provider,
      metadata: {},
    };

    // Build the chain from innermost to outermost
    let next = () => handler(context.request);

    for (let i = this.middlewares.length - 1; i >= 0; i--) {
      const middleware = this.middlewares[i];
      const currentNext = next;
      next = () => middleware.fn(context, currentNext);
    }

    return next();
  }

  /**
   * List all middleware names in execution order.
   */
  list(): string[] {
    return this.middlewares.map((m) => m.name);
  }

  /**
   * Clear all middleware.
   */
  clear(): void {
    this.middlewares = [];
  }
}

// ============================================================================
// Built-in Middleware Factories
// ============================================================================

/**
 * Creates a logging middleware that logs request/response details.
 */
export function createLoggingMiddleware(
  logger: (message: string, data?: unknown) => void
): MiddlewareFn {
  return async (context, next) => {
    const start = Date.now();
    logger('AI request started', {
      provider: context.provider,
      model: context.request.model,
      messageCount: context.request.messages.length,
    });

    const response = await next();

    const duration = Date.now() - start;
    logger('AI request completed', {
      provider: context.provider,
      model: response.model,
      duration,
      tokens: response.usage.totalTokens,
    });

    return response;
  };
}

/**
 * Creates a caching middleware that caches responses based on request content.
 */
export function createCachingMiddleware(
  cache: Map<string, { response: AICompletionResponse; timestamp: number }>,
  ttlMs = 60000
): MiddlewareFn {
  return async (context, next) => {
    const key = JSON.stringify({
      model: context.request.model,
      messages: context.request.messages,
      temperature: context.request.temperature,
    });

    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      return cached.response;
    }

    const response = await next();
    cache.set(key, { response, timestamp: Date.now() });
    return response;
  };
}

/**
 * Creates a token budget enforcement middleware.
 */
export function createTokenBudgetMiddleware(maxTokens: number): MiddlewareFn {
  let totalUsed = 0;

  return async (context, next) => {
    if (totalUsed >= maxTokens) {
      throw new Error(
        `Token budget exceeded: used ${totalUsed}/${maxTokens} tokens`
      );
    }

    const response = await next();
    totalUsed += response.usage.totalTokens;
    context.metadata.totalTokensUsed = totalUsed;
    context.metadata.tokenBudgetRemaining = maxTokens - totalUsed;
    return response;
  };
}
