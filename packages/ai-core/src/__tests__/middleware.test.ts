import { describe, it, expect, beforeEach } from 'vitest';

import {
  MiddlewareChain,
  createLoggingMiddleware,
  createCachingMiddleware,
  createTokenBudgetMiddleware,
} from '../middleware.js';
import type {
  AICompletionRequest,
  AICompletionResponse,
} from '../types/index.js';

function createMockHandler(): (
  request: AICompletionRequest
) => Promise<AICompletionResponse> {
  return async (request) => ({
    content: `Response to: ${request.messages[0]?.content}`,
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    model: request.model,
    finishReason: 'stop' as const,
  });
}

describe('MiddlewareChain', () => {
  let chain: MiddlewareChain;
  let request: AICompletionRequest;

  beforeEach(() => {
    chain = new MiddlewareChain();
    request = {
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'gpt-4',
    };
  });

  it('should execute handler without middleware', async () => {
    const response = await chain.execute(request, 'openai', createMockHandler());
    expect(response.content).toBe('Response to: Hello');
  });

  it('should execute middleware in correct order', async () => {
    const order: string[] = [];

    chain.use('first', async (_ctx, next) => {
      order.push('first-before');
      const response = await next();
      order.push('first-after');
      return response;
    });

    chain.use('second', async (_ctx, next) => {
      order.push('second-before');
      const response = await next();
      order.push('second-after');
      return response;
    });

    await chain.execute(request, 'openai', createMockHandler());

    expect(order).toEqual([
      'first-before',
      'second-before',
      'second-after',
      'first-after',
    ]);
  });

  it('should allow middleware to modify the request', async () => {
    chain.use('modifier', async (ctx, next) => {
      ctx.request = {
        ...ctx.request,
        temperature: 0.5,
      };
      return next();
    });

    const handler = async (req: AICompletionRequest) => ({
      content: `temp: ${req.temperature}`,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: req.model,
      finishReason: 'stop' as const,
    });

    const response = await chain.execute(request, 'openai', handler);
    expect(response.content).toBe('temp: 0.5');
  });

  it('should allow middleware to modify the response', async () => {
    chain.use('modifier', async (_ctx, next) => {
      const response = await next();
      return { ...response, content: response.content.toUpperCase() };
    });

    const response = await chain.execute(request, 'openai', createMockHandler());
    expect(response.content).toBe('RESPONSE TO: HELLO');
  });

  it('should remove middleware by name', () => {
    chain.use('first', async (_ctx, next) => next());
    chain.use('second', async (_ctx, next) => next());

    expect(chain.list()).toEqual(['first', 'second']);

    const removed = chain.remove('first');
    expect(removed).toBe(true);
    expect(chain.list()).toEqual(['second']);
  });

  it('should return false when removing nonexistent middleware', () => {
    expect(chain.remove('nonexistent')).toBe(false);
  });

  it('should list middleware names', () => {
    chain.use('logging', async (_ctx, next) => next());
    chain.use('caching', async (_ctx, next) => next());

    expect(chain.list()).toEqual(['logging', 'caching']);
  });

  it('should clear all middleware', () => {
    chain.use('logging', async (_ctx, next) => next());
    chain.use('caching', async (_ctx, next) => next());

    chain.clear();
    expect(chain.list()).toEqual([]);
  });
});

describe('createLoggingMiddleware', () => {
  it('should log request and response', async () => {
    const logs: Array<{ message: string; data?: unknown }> = [];
    const logger = (message: string, data?: unknown) => {
      logs.push({ message, data });
    };

    const chain = new MiddlewareChain();
    chain.use('logging', createLoggingMiddleware(logger));

    const request: AICompletionRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'gpt-4',
    };

    await chain.execute(request, 'openai', createMockHandler());

    expect(logs).toHaveLength(2);
    expect(logs[0].message).toBe('AI request started');
    expect(logs[1].message).toBe('AI request completed');
  });
});

describe('createCachingMiddleware', () => {
  it('should cache responses', async () => {
    const cache = new Map<
      string,
      { response: AICompletionResponse; timestamp: number }
    >();
    let handlerCallCount = 0;

    const chain = new MiddlewareChain();
    chain.use('caching', createCachingMiddleware(cache));

    const request: AICompletionRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'gpt-4',
    };

    const handler = async (req: AICompletionRequest) => {
      handlerCallCount++;
      return {
        content: `Response ${handlerCallCount}`,
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: req.model,
        finishReason: 'stop' as const,
      };
    };

    const response1 = await chain.execute(request, 'openai', handler);
    const response2 = await chain.execute(request, 'openai', handler);

    expect(response1.content).toBe('Response 1');
    expect(response2.content).toBe('Response 1'); // Cached
    expect(handlerCallCount).toBe(1);
  });

  it('should not use expired cache entries', async () => {
    const cache = new Map<
      string,
      { response: AICompletionResponse; timestamp: number }
    >();
    let handlerCallCount = 0;

    const chain = new MiddlewareChain();
    chain.use('caching', createCachingMiddleware(cache, 0)); // TTL of 0ms

    const request: AICompletionRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'gpt-4',
    };

    const handler = async (req: AICompletionRequest) => {
      handlerCallCount++;
      return {
        content: `Response ${handlerCallCount}`,
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: req.model,
        finishReason: 'stop' as const,
      };
    };

    await chain.execute(request, 'openai', handler);
    // Wait just a tick for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 1));
    await chain.execute(request, 'openai', handler);

    expect(handlerCallCount).toBe(2);
  });
});

describe('createTokenBudgetMiddleware', () => {
  it('should track token usage', async () => {
    const chain = new MiddlewareChain();
    chain.use('budget', createTokenBudgetMiddleware(100));

    const request: AICompletionRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'gpt-4',
    };

    const response = await chain.execute(request, 'openai', createMockHandler());
    expect(response).toBeDefined();
  });

  it('should throw when budget is exceeded', async () => {
    const chain = new MiddlewareChain();
    chain.use('budget', createTokenBudgetMiddleware(10));

    const request: AICompletionRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'gpt-4',
    };

    // First request uses 15 tokens, which exceeds budget of 10
    await chain.execute(request, 'openai', createMockHandler());

    // Second request should fail since budget is exceeded
    await expect(
      chain.execute(request, 'openai', createMockHandler())
    ).rejects.toThrow('Token budget exceeded');
  });
});
