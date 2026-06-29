import Anthropic from '@anthropic-ai/sdk';

import {
  RateLimitError,
  AuthenticationError,
  ModelNotFoundError,
  TokenLimitError,
  AIProviderError,
} from '../errors.js';
import type {
  AICompletionRequest,
  AICompletionResponse,
  AIStreamChunk,
  AIMessage,
  FinishReason,
  ToolCall,
} from '../types/index.js';

import { BaseProvider, type BaseProviderConfig } from './base.provider.js';

const ANTHROPIC_MODELS = [
  'claude-3-5-sonnet-20241022',
  'claude-3-opus-20240229',
  'claude-3-haiku-20240307',
  'claude-3-sonnet-20240229',
];

export interface AnthropicProviderConfig extends BaseProviderConfig {
  baseURL?: string;
}

/**
 * Anthropic provider implementation using the @anthropic-ai/sdk.
 */
export class AnthropicProvider extends BaseProvider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor(config: AnthropicProviderConfig) {
    super(config);
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeout,
      maxRetries: 0, // We handle retries in base class
    });
  }

  async countTokens(messages: AIMessage[], _model?: string): Promise<number> {
    // Approximate token count: ~4 chars per token for English text
    let totalChars = 0;
    for (const msg of messages) {
      totalChars += msg.content.length + msg.role.length + 4;
    }
    return Math.ceil(totalChars / 4);
  }

  async listModels(): Promise<string[]> {
    return [...ANTHROPIC_MODELS];
  }

  protected async doComplete(
    request: AICompletionRequest
  ): Promise<AICompletionResponse> {
    try {
      const params = this.buildParams(request);
      const response = await this.client.messages.create(params);

      const content = this.extractContent(response.content);
      const toolCalls = this.extractToolCalls(response.content);

      return {
        content,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens:
            response.usage.input_tokens + response.usage.output_tokens,
        },
        model: response.model,
        finishReason: this.mapStopReason(response.stop_reason),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  protected async *doStream(
    request: AICompletionRequest
  ): AsyncGenerator<AIStreamChunk> {
    try {
      const params = this.buildParams(request);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { stream: _stream, ...restParams } = params;
      const streamResponse = this.client.messages.stream({
        ...restParams,
        stream: true,
      });

      for await (const event of streamResponse) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield {
            delta: event.delta.text,
          };
        }
        if (event.type === 'message_stop') {
          yield {
            delta: '',
            finishReason: 'stop',
          };
        }
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private buildParams(
    request: AICompletionRequest
  ): Anthropic.MessageCreateParamsNonStreaming {
    const messages = this.formatMessages(request);
    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens ?? 4096,
      stream: false as const,
    };

    if (request.temperature !== undefined) {
      params.temperature = request.temperature;
    }
    if (request.topP !== undefined) {
      params.top_p = request.topP;
    }
    if (request.stop !== undefined) {
      params.stop_sequences = request.stop;
    }
    if (request.systemPrompt) {
      params.system = request.systemPrompt;
    }

    if (request.tools && request.tools.length > 0) {
      params.tools = request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters as Anthropic.Tool.InputSchema,
      }));
    }

    return params;
  }

  private formatMessages(
    request: AICompletionRequest
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    return request.messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: (msg.role === 'tool' ? 'user' : msg.role) as
          | 'user'
          | 'assistant',
        content: msg.content,
      }));
  }

  private extractContent(
    content: Array<{ type: string; text?: string }>
  ): string {
    return content
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');
  }

  private extractToolCalls(
    content: Array<{ type: string; id?: string; name?: string; input?: unknown }>
  ): ToolCall[] {
    return content
      .filter((block) => block.type === 'tool_use')
      .map((block) => ({
        id: block.id ?? '',
        name: block.name ?? '',
        arguments: (block.input as Record<string, unknown>) ?? {},
      }));
  }

  private mapStopReason(reason: string | null): FinishReason {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      default:
        return 'stop';
    }
  }

  private handleError(error: unknown): AIProviderError {
    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        const retryAfter = error.headers?.['retry-after']
          ? parseInt(error.headers['retry-after'] as string, 10)
          : undefined;
        return new RateLimitError(this.name, {
          retryAfter,
          originalError: error,
        });
      }
      if (error.status === 401) {
        return new AuthenticationError(this.name, { originalError: error });
      }
      if (error.status === 404) {
        return new ModelNotFoundError(this.name, 'unknown', {
          originalError: error,
        });
      }
      if (error.status === 400 && error.message?.includes('token')) {
        return new TokenLimitError(this.name, 0, 0, { originalError: error });
      }
      return new AIProviderError(error.message, this.name, {
        statusCode: error.status,
        originalError: error,
      });
    }
    return this.normalizeError(error);
  }
}
