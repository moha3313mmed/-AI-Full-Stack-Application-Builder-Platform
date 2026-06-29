import OpenAI from 'openai';

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

const OPENAI_MODELS = [
  'gpt-4',
  'gpt-4-turbo',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-3.5-turbo',
];

export interface OpenAIProviderConfig extends BaseProviderConfig {
  organizationId?: string;
  baseURL?: string;
}

/**
 * OpenAI provider implementation using the official openai SDK.
 */
export class OpenAIProvider extends BaseProvider {
  readonly name = 'openai';
  private client: OpenAI;

  constructor(config: OpenAIProviderConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organizationId,
      baseURL: config.baseURL,
      timeout: config.timeout,
      maxRetries: 0, // We handle retries in base class
    });
  }

  async countTokens(messages: AIMessage[], _model?: string): Promise<number> {
    // Approximate token count: ~4 chars per token for English text
    let totalChars = 0;
    for (const msg of messages) {
      totalChars += msg.content.length + msg.role.length + 4; // role overhead
    }
    return Math.ceil(totalChars / 4);
  }

  async listModels(): Promise<string[]> {
    return [...OPENAI_MODELS];
  }

  protected async doComplete(
    request: AICompletionRequest
  ): Promise<AICompletionResponse> {
    try {
      const params = this.buildParams(request);
      const response = await this.client.chat.completions.create(params);

      const choice = response.choices[0];
      const toolCalls = this.extractToolCalls(choice?.message?.tool_calls);

      return {
        content: choice?.message?.content ?? '',
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
        model: response.model,
        finishReason: this.mapFinishReason(choice?.finish_reason),
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
      const stream = await this.client.chat.completions.create({
        ...params,
        stream: true as const,
      });

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice) {
          yield {
            delta: choice.delta?.content ?? '',
            finishReason: choice.finish_reason
              ? this.mapFinishReason(choice.finish_reason)
              : undefined,
          };
        }
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private buildParams(
    request: AICompletionRequest
  ): OpenAI.Chat.ChatCompletionCreateParamsNonStreaming {
    const messages = this.formatMessages(request);
    const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: request.model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
    };

    if (request.temperature !== undefined) {
      params.temperature = request.temperature;
    }
    if (request.maxTokens !== undefined) {
      params.max_tokens = request.maxTokens;
    }
    if (request.stop !== undefined) {
      params.stop = request.stop;
    }
    if (request.topP !== undefined) {
      params.top_p = request.topP;
    }

    if (request.tools && request.tools.length > 0) {
      params.tools = request.tools.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters as Record<string, unknown>,
        },
      }));
    }

    return params;
  }

  private formatMessages(
    request: AICompletionRequest
  ): Array<{ role: string; content: string; tool_call_id?: string }> {
    const messages: Array<{
      role: string;
      content: string;
      tool_call_id?: string;
    }> = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    for (const msg of request.messages) {
      const formatted: { role: string; content: string; tool_call_id?: string } =
        {
          role: msg.role,
          content: msg.content,
        };
      if (msg.role === 'tool' && msg.toolCallId) {
        formatted.tool_call_id = msg.toolCallId;
      }
      messages.push(formatted);
    }

    return messages;
  }

  private extractToolCalls(
    toolCalls?: Array<{
      id: string;
      function: { name: string; arguments: string };
    }>
  ): ToolCall[] {
    if (!toolCalls) return [];
    return toolCalls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }));
  }

  private mapFinishReason(reason?: string | null): FinishReason {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      case 'tool_calls':
        return 'tool_calls';
      default:
        return 'stop';
    }
  }

  private handleError(error: unknown): AIProviderError {
    if (error instanceof OpenAI.APIError) {
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
