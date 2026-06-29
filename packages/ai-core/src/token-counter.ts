import type { AIMessage } from './types/index.js';

/**
 * Token counting utilities that work across providers.
 * Uses character-based approximation as the default strategy.
 */
export class TokenCounter {
  /**
   * Estimate token count for a list of messages.
   * Uses approximately 4 characters per token for English text.
   */
  estimateTokens(messages: AIMessage[]): number {
    let totalChars = 0;
    for (const msg of messages) {
      // Account for role and message structure overhead
      totalChars += msg.content.length + msg.role.length + 4;
    }
    return Math.ceil(totalChars / 4);
  }

  /**
   * Estimate token count for a single string.
   */
  estimateStringTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if a message list is within a given token budget.
   */
  isWithinBudget(messages: AIMessage[], maxTokens: number): boolean {
    return this.estimateTokens(messages) <= maxTokens;
  }

  /**
   * Get the model's context window size.
   */
  getContextWindowSize(model: string): number {
    const contextWindows: Record<string, number> = {
      'gpt-4': 8192,
      'gpt-4-turbo': 128000,
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'gpt-3.5-turbo': 16385,
      'claude-3-5-sonnet-20241022': 200000,
      'claude-3-opus-20240229': 200000,
      'claude-3-haiku-20240307': 200000,
      'claude-3-sonnet-20240229': 200000,
      'gemini-pro': 32768,
      'gemini-ultra': 32768,
      'gemini-1.5-pro': 1048576,
      'gemini-1.5-flash': 1048576,
    };
    return contextWindows[model] ?? 4096;
  }

  /**
   * Calculate remaining tokens available for a response given messages and model.
   */
  getRemainingTokens(messages: AIMessage[], model: string): number {
    const contextWindow = this.getContextWindowSize(model);
    const usedTokens = this.estimateTokens(messages);
    return Math.max(0, contextWindow - usedTokens);
  }
}
