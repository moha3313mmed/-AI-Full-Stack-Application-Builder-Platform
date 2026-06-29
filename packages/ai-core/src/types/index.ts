// ============================================================================
// Core AI Provider Types
// ============================================================================

/**
 * Represents a message in a conversation with an AI model.
 */
export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  metadata?: Record<string, unknown>;
  toolCallId?: string;
}

/**
 * Definition of a tool that can be invoked by the AI model.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Represents an invocation of a tool by the AI model.
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Request for an AI completion.
 */
export interface AICompletionRequest {
  messages: AIMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  systemPrompt?: string;
  stop?: string[];
  topP?: number;
}

/**
 * Token usage statistics for a completion.
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * The reason a completion finished.
 */
export type FinishReason = 'stop' | 'length' | 'content_filter' | 'tool_calls';

/**
 * Response from an AI completion request.
 */
export interface AICompletionResponse {
  content: string;
  usage: TokenUsage;
  model: string;
  finishReason: FinishReason;
  toolCalls?: ToolCall[];
}

/**
 * A chunk of streamed AI response.
 */
export interface AIStreamChunk {
  delta: string;
  finishReason?: FinishReason;
  toolCalls?: ToolCall[];
}

/**
 * The interface that all AI providers must implement.
 */
export interface AIProvider {
  readonly name: string;

  /**
   * Generate a completion from the AI model.
   */
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;

  /**
   * Stream a completion from the AI model.
   */
  stream(request: AICompletionRequest): AsyncGenerator<AIStreamChunk>;

  /**
   * Count tokens for a set of messages.
   */
  countTokens(messages: AIMessage[], model?: string): Promise<number>;

  /**
   * List available models from this provider.
   */
  listModels(): Promise<string[]>;
}

/**
 * Configuration for middleware processing.
 */
export interface MiddlewareContext {
  request: AICompletionRequest;
  provider: string;
  metadata: Record<string, unknown>;
}

/**
 * Middleware function signature for processing requests and responses.
 */
export type MiddlewareFn = (
  context: MiddlewareContext,
  next: () => Promise<AICompletionResponse>
) => Promise<AICompletionResponse>;
