// @builder/ai-core - AI Provider Abstraction Layer
//
// This package provides a unified interface for interacting with multiple
// AI providers (OpenAI, Anthropic, Google Gemini) through a common abstraction.

// ============================================================================
// Types
// ============================================================================

export type {
  AIMessage,
  AICompletionRequest,
  AICompletionResponse,
  AIStreamChunk,
  AIProvider,
  ToolDefinition,
  ToolCall,
  TokenUsage,
  FinishReason,
  MiddlewareContext,
  MiddlewareFn,
} from './types/index.js';

// ============================================================================
// Errors
// ============================================================================

export {
  AIProviderError,
  RateLimitError,
  TokenLimitError,
  AuthenticationError,
  ModelNotFoundError,
} from './errors.js';

// ============================================================================
// Providers
// ============================================================================

export {
  BaseProvider,
  type BaseProviderConfig,
  OpenAIProvider,
  type OpenAIProviderConfig,
  AnthropicProvider,
  type AnthropicProviderConfig,
  GeminiProvider,
  type GeminiProviderConfig,
} from './providers/index.js';

// ============================================================================
// Registry
// ============================================================================

export { ProviderRegistry } from './registry.js';

// ============================================================================
// Router
// ============================================================================

export { ModelRouter, type RouteRule } from './router.js';

// ============================================================================
// Token Counter
// ============================================================================

export { TokenCounter } from './token-counter.js';

// ============================================================================
// Middleware
// ============================================================================

export {
  MiddlewareChain,
  createLoggingMiddleware,
  createCachingMiddleware,
  createTokenBudgetMiddleware,
} from './middleware.js';
