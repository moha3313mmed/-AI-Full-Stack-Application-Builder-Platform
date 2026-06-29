import type { AICompletionRequest, AICompletionResponse } from '@builder/ai-core';
import {
  AnthropicProvider,
  GeminiProvider,
  OpenAIProvider,
  ProviderRegistry,
} from '@builder/ai-core';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CompletionDto } from './dto/completion.dto';

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private readonly registry: ProviderRegistry;

  constructor(private readonly configService: ConfigService) {
    this.registry = new ProviderRegistry();
  }

  onModuleInit(): void {
    this.registerProviders();
  }

  private registerProviders(): void {
    const openaiKey = this.configService.get<string>('ai.openaiApiKey');
    if (openaiKey) {
      this.registry.register('openai', new OpenAIProvider({ apiKey: openaiKey }));
      this.logger.log('Registered OpenAI provider');
    }

    const anthropicKey = this.configService.get<string>('ai.anthropicApiKey');
    if (anthropicKey) {
      this.registry.register('anthropic', new AnthropicProvider({ apiKey: anthropicKey }));
      this.logger.log('Registered Anthropic provider');
    }

    const geminiKey = this.configService.get<string>('ai.geminiApiKey');
    if (geminiKey) {
      this.registry.register('gemini', new GeminiProvider({ apiKey: geminiKey }));
      this.logger.log('Registered Gemini provider');
    }

    if (this.registry.list().length === 0) {
      this.logger.warn(
        'No AI providers registered. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY to enable providers.',
      );
    }
  }

  async complete(dto: CompletionDto): Promise<AICompletionResponse> {
    this.logger.log(`Processing completion request for model: ${dto.model}`);

    const request: AICompletionRequest = {
      model: dto.model,
      messages: dto.messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
    };

    const provider = this.registry.get(dto.provider || 'openai');
    if (!provider) {
      throw new Error(`Provider "${dto.provider || 'openai'}" not found`);
    }
    return provider.complete(request);
  }

  getAvailableProviders(): string[] {
    return this.registry.list();
  }

  getProvider(name: string) {
    return this.registry.get(name);
  }
}
