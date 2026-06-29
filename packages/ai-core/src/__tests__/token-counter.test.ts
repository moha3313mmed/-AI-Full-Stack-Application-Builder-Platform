import { describe, it, expect } from 'vitest';

import { TokenCounter } from '../token-counter.js';
import type { AIMessage } from '../types/index.js';

describe('TokenCounter', () => {
  const counter = new TokenCounter();

  describe('estimateTokens', () => {
    it('should estimate tokens for a list of messages', () => {
      const messages: AIMessage[] = [
        { role: 'user', content: 'Hello, how are you?' },
        { role: 'assistant', content: 'I am doing well, thank you!' },
      ];

      const estimate = counter.estimateTokens(messages);
      expect(estimate).toBeGreaterThan(0);
      expect(typeof estimate).toBe('number');
    });

    it('should return 0 for empty messages', () => {
      const estimate = counter.estimateTokens([]);
      expect(estimate).toBe(0);
    });

    it('should increase with more content', () => {
      const short: AIMessage[] = [{ role: 'user', content: 'Hi' }];
      const long: AIMessage[] = [
        { role: 'user', content: 'This is a much longer message that should have more tokens' },
      ];

      expect(counter.estimateTokens(long)).toBeGreaterThan(
        counter.estimateTokens(short)
      );
    });
  });

  describe('estimateStringTokens', () => {
    it('should estimate tokens for a string', () => {
      const estimate = counter.estimateStringTokens('Hello, world!');
      expect(estimate).toBeGreaterThan(0);
    });

    it('should return 0 for empty string', () => {
      expect(counter.estimateStringTokens('')).toBe(0);
    });
  });

  describe('isWithinBudget', () => {
    it('should return true when within budget', () => {
      const messages: AIMessage[] = [{ role: 'user', content: 'Hi' }];
      expect(counter.isWithinBudget(messages, 1000)).toBe(true);
    });

    it('should return false when exceeding budget', () => {
      const messages: AIMessage[] = [{ role: 'user', content: 'Hi' }];
      expect(counter.isWithinBudget(messages, 1)).toBe(false);
    });
  });

  describe('getContextWindowSize', () => {
    it('should return known context window sizes', () => {
      expect(counter.getContextWindowSize('gpt-4')).toBe(8192);
      expect(counter.getContextWindowSize('gpt-4-turbo')).toBe(128000);
      expect(counter.getContextWindowSize('claude-3-5-sonnet-20241022')).toBe(200000);
      expect(counter.getContextWindowSize('gemini-1.5-pro')).toBe(1048576);
    });

    it('should return default for unknown models', () => {
      expect(counter.getContextWindowSize('unknown-model')).toBe(4096);
    });
  });

  describe('getRemainingTokens', () => {
    it('should calculate remaining tokens', () => {
      const messages: AIMessage[] = [{ role: 'user', content: 'Hi' }];
      const remaining = counter.getRemainingTokens(messages, 'gpt-4');
      expect(remaining).toBeLessThan(8192);
      expect(remaining).toBeGreaterThan(0);
    });

    it('should return 0 when context is full', () => {
      const longContent = 'a'.repeat(100000);
      const messages: AIMessage[] = [{ role: 'user', content: longContent }];
      const remaining = counter.getRemainingTokens(messages, 'gpt-4');
      expect(remaining).toBe(0);
    });
  });
});
