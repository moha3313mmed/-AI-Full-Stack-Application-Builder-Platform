export class ProviderRegistry {
  private providers = new Map<string, unknown>();

  register(name: string, provider: unknown): void {
    this.providers.set(name, provider);
  }

  get(name: string): unknown {
    return this.providers.get(name);
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }
}

export class ModelRouter {}
export class MiddlewareChain {}
export class TokenCounter {}
export const createLoggingMiddleware = jest.fn();
export const createCachingMiddleware = jest.fn();
export const createTokenBudgetMiddleware = jest.fn();
