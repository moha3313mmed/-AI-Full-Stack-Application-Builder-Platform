import type { AIProvider, AICompletionRequest } from '@builder/ai-core';

import type { FileOperation } from '../vfs/types.js';

import { PromptBuilder } from './prompt-builder.js';
import type { CodeGenRequest, CodeGenResult, FileContext } from './types.js';

// ============================================================================
// Code Generator - AI-powered code generation
// ============================================================================

/**
 * Generates code using AI providers from @builder/ai-core.
 * Takes a description and existing file context, produces file operations.
 */
export class CodeGenerator {
  private promptBuilder: PromptBuilder;

  constructor() {
    this.promptBuilder = new PromptBuilder();
  }

  /**
   * Generate new code based on a request description.
   */
  async generateCode(
    request: CodeGenRequest,
    provider: AIProvider
  ): Promise<CodeGenResult> {
    try {
      const prompt = this.promptBuilder.buildGenerationPrompt(request);
      const response = await this.callProvider(provider, prompt, request);
      return this.parseResponse(response);
    } catch (error) {
      return {
        operations: [],
        explanation: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during code generation',
      };
    }
  }

  /**
   * Modify existing code based on a request.
   */
  async modifyCode(
    request: CodeGenRequest,
    existingCode: FileContext[],
    provider: AIProvider
  ): Promise<CodeGenResult> {
    try {
      const prompt = this.promptBuilder.buildModificationPrompt(request, existingCode);
      const response = await this.callProvider(provider, prompt, request);
      return this.parseResponse(response);
    } catch (error) {
      return {
        operations: [],
        explanation: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during code modification',
      };
    }
  }

  /**
   * Refactor existing code based on a request.
   */
  async refactorCode(
    request: CodeGenRequest,
    existingCode: FileContext[],
    provider: AIProvider
  ): Promise<CodeGenResult> {
    try {
      const prompt = this.promptBuilder.buildRefactoringPrompt(request, existingCode);
      const response = await this.callProvider(provider, prompt, request);
      return this.parseResponse(response);
    } catch (error) {
      return {
        operations: [],
        explanation: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during code refactoring',
      };
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async callProvider(
    provider: AIProvider,
    prompt: string,
    request: CodeGenRequest
  ): Promise<string> {
    const completionRequest: AICompletionRequest = {
      messages: [
        { role: 'system', content: 'You are a code generation assistant. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      model: request.model || 'gpt-4',
      temperature: request.temperature ?? 0.2,
      maxTokens: 4096,
    };

    const response = await provider.complete(completionRequest);
    return response.content;
  }

  private parseResponse(content: string): CodeGenResult {
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr.trim());

      const operations: FileOperation[] = (parsed.operations || []).map(
        (op: Record<string, unknown>) => ({
          type: op.type as string,
          path: op.path as string,
          content: op.content as string | undefined,
          language: op.language as string | undefined,
        })
      );

      return {
        operations,
        explanation: parsed.explanation || '',
        success: true,
      };
    } catch {
      return {
        operations: [],
        explanation: '',
        success: false,
        error: 'Failed to parse AI response as valid JSON',
      };
    }
  }
}
