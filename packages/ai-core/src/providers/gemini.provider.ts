import {
  GoogleGenerativeAI,
  type Content,
  type GenerateContentRequest,
  type Tool,
  type FunctionDeclarationSchema,
  SchemaType,
} from '@google/generative-ai';

import { AIProviderError, AuthenticationError } from '../errors.js';
import type {
  AICompletionRequest,
  AICompletionResponse,
  AIStreamChunk,
  AIMessage,
  FinishReason,
  ToolCall,
} from '../types/index.js';

import { BaseProvider, type BaseProviderConfig } from './base.provider.js';

const GEMINI_MODELS = [
  'gemini-pro',
  'gemini-pro-vision',
  'gemini-ultra',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
];

export interface GeminiProviderConfig extends BaseProviderConfig {
  baseURL?: string;
}

/**
 * Google Gemini provider implementation using @google/generative-ai.
 */
export class GeminiProvider extends BaseProvider {
  readonly name = 'gemini';
  private client: GoogleGenerativeAI;

  constructor(config: GeminiProviderConfig) {
    super(config);
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  async countTokens(messages: AIMessage[], model?: string): Promise<number> {
    try {
      const genModel = this.client.getGenerativeModel({
        model: model ?? 'gemini-pro',
      });
      const contents: Content[] = this.formatContents(messages);
      const result = await genModel.countTokens({ contents });
      return result.totalTokens;
    } catch {
      // Fallback to approximation
      let totalChars = 0;
      for (const msg of messages) {
        totalChars += msg.content.length + msg.role.length + 4;
      }
      return Math.ceil(totalChars / 4);
    }
  }

  async listModels(): Promise<string[]> {
    return [...GEMINI_MODELS];
  }

  protected async doComplete(
    request: AICompletionRequest
  ): Promise<AICompletionResponse> {
    try {
      const genModel = this.client.getGenerativeModel({
        model: request.model,
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          topP: request.topP,
          stopSequences: request.stop,
        },
        systemInstruction: request.systemPrompt
          ? { role: 'system', parts: [{ text: request.systemPrompt }] }
          : undefined,
      });

      const contents = this.formatContents(request.messages);
      const tools = this.formatTools(request);

      const generateRequest: GenerateContentRequest = {
        contents,
        ...(tools ? { tools } : {}),
      };

      const result = await genModel.generateContent(generateRequest);

      const response = result.response;
      const text = response.text();
      const toolCalls = this.extractToolCalls(response);
      const usage = response.usageMetadata;

      return {
        content: text,
        usage: {
          promptTokens: usage?.promptTokenCount ?? 0,
          completionTokens: usage?.candidatesTokenCount ?? 0,
          totalTokens: usage?.totalTokenCount ?? 0,
        },
        model: request.model,
        finishReason: this.mapFinishReason(response),
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
      const genModel = this.client.getGenerativeModel({
        model: request.model,
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          topP: request.topP,
          stopSequences: request.stop,
        },
        systemInstruction: request.systemPrompt
          ? { role: 'system', parts: [{ text: request.systemPrompt }] }
          : undefined,
      });

      const contents = this.formatContents(request.messages);
      const tools = this.formatTools(request);

      const generateRequest: GenerateContentRequest = {
        contents,
        ...(tools ? { tools } : {}),
      };

      const result = await genModel.generateContentStream(generateRequest);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        yield {
          delta: text,
        };
      }

      yield {
        delta: '',
        finishReason: 'stop',
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private formatContents(messages: AIMessage[]): Content[] {
    return messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));
  }

  private formatTools(request: AICompletionRequest): Tool[] | undefined {
    if (!request.tools || request.tools.length === 0) return undefined;
    return [
      {
        functionDeclarations: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: {
            type: SchemaType.OBJECT,
            properties: ((tool.parameters as Record<string, unknown>).properties ?? {}) as Record<string, unknown>,
          } as unknown as FunctionDeclarationSchema,
        })),
      },
    ];
  }

  private extractToolCalls(response: {
    candidates?: Array<{
      content?: { parts?: Array<{ functionCall?: { name: string; args: unknown } }> };
    }>;
  }): ToolCall[] {
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) return [];
    return candidate.content.parts
      .filter(
        (part): part is { functionCall: { name: string; args: unknown } } =>
          !!part.functionCall
      )
      .map((part, index) => ({
        id: `call_${index}`,
        name: part.functionCall.name,
        arguments: (part.functionCall.args as Record<string, unknown>) ?? {},
      }));
  }

  private mapFinishReason(_response: unknown): FinishReason {
    // Gemini doesn't expose finish reason directly in a simple way
    return 'stop';
  }

  private handleError(error: unknown): AIProviderError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (
        message.includes('api key') ||
        message.includes('authentication') ||
        message.includes('unauthorized')
      ) {
        return new AuthenticationError(this.name, { originalError: error });
      }
      return new AIProviderError(error.message, this.name, {
        originalError: error,
      });
    }
    return this.normalizeError(error);
  }
}
