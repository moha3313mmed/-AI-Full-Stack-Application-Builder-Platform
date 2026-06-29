import {
  AIProviderError,
  RateLimitError,
  AuthenticationError,
} from '../errors.js';
import type {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIStreamChunk,
  AIMessage,
} from '../types/index.js';

export interface BaseProviderConfig {
  apiKey: string;
  maxRetries?: number;
  baseDelay?: number;
  timeout?: number;
}

/**
 * Abstract base class for AI providers implementing common logic:
 * - Retry with exponential backoff
 * - Error normalization
 * - Request validation
 * - Usage tracking
 */
export abstract class BaseProvider implements AIProvider {
  abstract readonly name: string;

  protected readonly apiKey: string;
  protected readonly maxRetries: number;
  protected readonly baseDelay: number;
  protected readonly timeout: number;

  private _totalTokensUsed = 0;
  private _requestCount = 0;

  constructor(config: BaseProviderConfig) {
    this.apiKey = config.apiKey;
    this.maxRetries = config.maxRetries ?? 3;
    this.baseDelay = config.baseDelay ?? 1000;
    this.timeout = config.timeout ?? 30000;
  }

  get totalTokensUsed(): number {
    return this._totalTokensUsed;
  }

  get requestCount(): number {
    return this._requestCount;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    this.validateRequest(request);
    const response = await this.withRetry(() => this.doComplete(request));
    this._totalTokensUsed += response.usage.totalTokens;
    this._requestCount++;
    return response;
  }

  async *stream(request: AICompletionRequest): AsyncGenerator<AIStreamChunk> {
    this.validateRequest(request);
    this._requestCount++;
    yield* this.doStream(request);
  }

  abstract countTokens(messages: AIMessage[], model?: string): Promise<number>;
  abstract listModels(): Promise<string[]>;

  protected abstract doComplete(
    request: AICompletionRequest
  ): Promise<AICompletionResponse>;

  protected abstract doStream(
    request: AICompletionRequest
  ): AsyncGenerator<AIStreamChunk>;

  protected validateRequest(request: AICompletionRequest): void {
    if (!request.messages || request.messages.length === 0) {
      throw new AIProviderError('Messages array cannot be empty', this.name);
    }
    if (!request.model) {
      throw new AIProviderError('Model must be specified', this.name);
    }
    if (
      request.temperature !== undefined &&
      (request.temperature < 0 || request.temperature > 2)
    ) {
      throw new AIProviderError(
        'Temperature must be between 0 and 2',
        this.name
      );
    }
  }

  protected async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (error instanceof AuthenticationError) {
          throw error;
        }
        if (error instanceof RateLimitError && error.retryAfter) {
          if (attempt < this.maxRetries) {
            await this.delay(error.retryAfter * 1000);
            continue;
          }
        }
        if (attempt < this.maxRetries) {
          const delayMs = this.baseDelay * Math.pow(2, attempt);
          await this.delay(delayMs);
        }
      }
    }
    throw lastError;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected normalizeError(error: unknown): AIProviderError {
    if (error instanceof AIProviderError) {
      return error;
    }
    if (error instanceof Error) {
      return new AIProviderError(error.message, this.name, {
        originalError: error,
      });
    }
    return new AIProviderError(String(error), this.name, {
      originalError: error,
    });
  }
}
