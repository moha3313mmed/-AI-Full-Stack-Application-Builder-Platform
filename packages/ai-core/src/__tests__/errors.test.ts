import { describe, it, expect } from 'vitest';

import {
  AIProviderError,
  RateLimitError,
  TokenLimitError,
  AuthenticationError,
  ModelNotFoundError,
} from '../errors.js';

describe('Error Hierarchy', () => {
  describe('AIProviderError', () => {
    it('should create a base provider error', () => {
      const error = new AIProviderError('Something failed', 'openai', {
        statusCode: 500,
      });
      expect(error.message).toBe('Something failed');
      expect(error.provider).toBe('openai');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('AIProviderError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should store the original error', () => {
      const original = new Error('Original');
      const error = new AIProviderError('Wrapped', 'openai', {
        originalError: original,
      });
      expect(error.originalError).toBe(original);
    });
  });

  describe('RateLimitError', () => {
    it('should create a rate limit error with retryAfter', () => {
      const error = new RateLimitError('openai', { retryAfter: 30 });
      expect(error.message).toContain('Rate limit exceeded');
      expect(error.message).toContain('openai');
      expect(error.message).toContain('Retry after 30s');
      expect(error.retryAfter).toBe(30);
      expect(error.statusCode).toBe(429);
      expect(error.name).toBe('RateLimitError');
      expect(error).toBeInstanceOf(AIProviderError);
    });

    it('should create a rate limit error without retryAfter', () => {
      const error = new RateLimitError('anthropic');
      expect(error.message).toContain('Rate limit exceeded');
      expect(error.retryAfter).toBeUndefined();
    });
  });

  describe('TokenLimitError', () => {
    it('should create a token limit error', () => {
      const error = new TokenLimitError('openai', 4096, 5000);
      expect(error.message).toContain('Token limit exceeded');
      expect(error.message).toContain('4096');
      expect(error.message).toContain('5000');
      expect(error.tokenLimit).toBe(4096);
      expect(error.tokensRequested).toBe(5000);
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('TokenLimitError');
      expect(error).toBeInstanceOf(AIProviderError);
    });
  });

  describe('AuthenticationError', () => {
    it('should create an authentication error', () => {
      const error = new AuthenticationError('openai');
      expect(error.message).toContain('Authentication failed');
      expect(error.message).toContain('openai');
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('AuthenticationError');
      expect(error).toBeInstanceOf(AIProviderError);
    });
  });

  describe('ModelNotFoundError', () => {
    it('should create a model not found error', () => {
      const error = new ModelNotFoundError('openai', 'gpt-5');
      expect(error.message).toContain("Model 'gpt-5' not found");
      expect(error.message).toContain('openai');
      expect(error.model).toBe('gpt-5');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('ModelNotFoundError');
      expect(error).toBeInstanceOf(AIProviderError);
    });
  });
});
