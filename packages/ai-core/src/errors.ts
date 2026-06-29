/**
 * Base error class for all AI provider errors.
 */
export class AIProviderError extends Error {
  public readonly provider: string;
  public readonly statusCode?: number;
  public readonly originalError?: unknown;

  constructor(
    message: string,
    provider: string,
    options?: { statusCode?: number; originalError?: unknown }
  ) {
    super(message);
    this.name = 'AIProviderError';
    this.provider = provider;
    this.statusCode = options?.statusCode;
    this.originalError = options?.originalError;
  }
}

/**
 * Error thrown when a provider rate limit is hit.
 */
export class RateLimitError extends AIProviderError {
  public readonly retryAfter?: number;

  constructor(
    provider: string,
    options?: { retryAfter?: number; originalError?: unknown }
  ) {
    super(
      `Rate limit exceeded for provider: ${provider}${options?.retryAfter ? `. Retry after ${options.retryAfter}s` : ''}`,
      provider,
      { statusCode: 429, originalError: options?.originalError }
    );
    this.name = 'RateLimitError';
    this.retryAfter = options?.retryAfter;
  }
}

/**
 * Error thrown when a token limit is exceeded.
 */
export class TokenLimitError extends AIProviderError {
  public readonly tokenLimit: number;
  public readonly tokensRequested: number;

  constructor(
    provider: string,
    tokenLimit: number,
    tokensRequested: number,
    options?: { originalError?: unknown }
  ) {
    super(
      `Token limit exceeded for provider: ${provider}. Limit: ${tokenLimit}, requested: ${tokensRequested}`,
      provider,
      { statusCode: 400, originalError: options?.originalError }
    );
    this.name = 'TokenLimitError';
    this.tokenLimit = tokenLimit;
    this.tokensRequested = tokensRequested;
  }
}

/**
 * Error thrown when authentication with a provider fails.
 */
export class AuthenticationError extends AIProviderError {
  constructor(provider: string, options?: { originalError?: unknown }) {
    super(`Authentication failed for provider: ${provider}`, provider, {
      statusCode: 401,
      originalError: options?.originalError,
    });
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when a requested model is not found.
 */
export class ModelNotFoundError extends AIProviderError {
  public readonly model: string;

  constructor(
    provider: string,
    model: string,
    options?: { originalError?: unknown }
  ) {
    super(`Model '${model}' not found for provider: ${provider}`, provider, {
      statusCode: 404,
      originalError: options?.originalError,
    });
    this.name = 'ModelNotFoundError';
    this.model = model;
  }
}
