import type { AIProvider } from '@builder/ai-core';
import { describe, it, expect, beforeEach } from 'vitest';


import { CodeGenerator } from '../codegen/code-generator.js';
import type { CodeGenRequest } from '../codegen/types.js';

function createMockProvider(responseContent: string): AIProvider {
  return {
    name: 'mock-provider',
    complete: async () => ({
      content: responseContent,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      model: 'mock-model',
      finishReason: 'stop' as const,
    }),
    stream: async function* () {
      yield { delta: responseContent };
    },
    countTokens: async () => 100,
    listModels: async () => ['mock-model'],
  };
}

function createFailingProvider(): AIProvider {
  return {
    name: 'failing-provider',
    complete: async () => {
      throw new Error('Provider error: rate limited');
    },
    // eslint-disable-next-line require-yield
    stream: async function* () {
      throw new Error('Provider error');
    },
    countTokens: async () => 0,
    listModels: async () => [],
  };
}

describe('CodeGenerator', () => {
  let generator: CodeGenerator;

  beforeEach(() => {
    generator = new CodeGenerator();
  });

  describe('Generate Code', () => {
    it('should generate code from a valid AI response', async () => {
      const mockResponse = JSON.stringify({
        operations: [
          {
            type: 'create',
            path: '/src/utils.ts',
            content: 'export function add(a: number, b: number) { return a + b; }',
            language: 'typescript',
          },
        ],
        explanation: 'Created a utility function',
      });

      const provider = createMockProvider(mockResponse);
      const request: CodeGenRequest = {
        description: 'Create a utility function for adding numbers',
        language: 'typescript',
      };

      const result = await generator.generateCode(request, provider);
      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].type).toBe('create');
      expect(result.operations[0].path).toBe('/src/utils.ts');
      expect(result.explanation).toBe('Created a utility function');
    });

    it('should handle JSON response wrapped in code blocks', async () => {
      const mockResponse = '```json\n' + JSON.stringify({
        operations: [
          { type: 'create', path: '/src/hello.ts', content: 'export const hello = "world";' },
        ],
        explanation: 'Created hello module',
      }) + '\n```';

      const provider = createMockProvider(mockResponse);
      const request: CodeGenRequest = { description: 'Create hello module' };

      const result = await generator.generateCode(request, provider);
      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
    });

    it('should handle multiple file operations', async () => {
      const mockResponse = JSON.stringify({
        operations: [
          { type: 'create', path: '/src/types.ts', content: 'export interface User {}' },
          { type: 'create', path: '/src/service.ts', content: 'import { User } from "./types";' },
          { type: 'update', path: '/src/index.ts', content: 'export * from "./types";' },
        ],
        explanation: 'Created user types and service',
      });

      const provider = createMockProvider(mockResponse);
      const request: CodeGenRequest = {
        description: 'Create user types and service',
        framework: 'express',
      };

      const result = await generator.generateCode(request, provider);
      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(3);
    });

    it('should return failure on invalid JSON response', async () => {
      const provider = createMockProvider('This is not JSON at all');
      const request: CodeGenRequest = { description: 'Generate something' };

      const result = await generator.generateCode(request, provider);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse');
    });

    it('should return failure when provider throws', async () => {
      const provider = createFailingProvider();
      const request: CodeGenRequest = { description: 'Generate code' };

      const result = await generator.generateCode(request, provider);
      expect(result.success).toBe(false);
      expect(result.error).toContain('rate limited');
    });
  });

  describe('Modify Code', () => {
    it('should modify existing code with context', async () => {
      const mockResponse = JSON.stringify({
        operations: [
          { type: 'update', path: '/src/app.ts', content: 'const app = "modified";' },
        ],
        explanation: 'Modified the app file',
      });

      const provider = createMockProvider(mockResponse);
      const request: CodeGenRequest = {
        description: 'Add error handling',
        framework: 'express',
      };
      const existingCode = [
        { path: '/src/app.ts', content: 'const app = "original";', language: 'typescript' },
      ];

      const result = await generator.modifyCode(request, existingCode, provider);
      expect(result.success).toBe(true);
      expect(result.operations[0].type).toBe('update');
    });

    it('should handle provider failure in modify', async () => {
      const provider = createFailingProvider();
      const request: CodeGenRequest = { description: 'Modify code' };

      const result = await generator.modifyCode(request, [], provider);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Refactor Code', () => {
    it('should refactor code with explanation', async () => {
      const mockResponse = JSON.stringify({
        operations: [
          { type: 'update', path: '/src/utils.ts', content: 'export const add = (a: number, b: number): number => a + b;' },
        ],
        explanation: 'Refactored to arrow function',
      });

      const provider = createMockProvider(mockResponse);
      const request: CodeGenRequest = {
        description: 'Convert to arrow functions',
        language: 'typescript',
      };
      const existingCode = [
        { path: '/src/utils.ts', content: 'export function add(a: number, b: number) { return a + b; }' },
      ];

      const result = await generator.refactorCode(request, existingCode, provider);
      expect(result.success).toBe(true);
      expect(result.explanation).toBe('Refactored to arrow function');
    });

    it('should handle provider failure in refactor', async () => {
      const provider = createFailingProvider();
      const request: CodeGenRequest = { description: 'Refactor code' };

      const result = await generator.refactorCode(request, [], provider);
      expect(result.success).toBe(false);
    });
  });

  describe('Request Configuration', () => {
    it('should pass framework context in request', async () => {
      const mockResponse = JSON.stringify({
        operations: [],
        explanation: 'Done',
      });

      const provider = createMockProvider(mockResponse);
      const request: CodeGenRequest = {
        description: 'Create a component',
        framework: 'react',
        language: 'typescript',
        temperature: 0.5,
        model: 'gpt-4-turbo',
      };

      const result = await generator.generateCode(request, provider);
      expect(result.success).toBe(true);
    });

    it('should include file context in request', async () => {
      const mockResponse = JSON.stringify({
        operations: [{ type: 'create', path: '/src/new.ts', content: 'new file' }],
        explanation: 'Generated',
      });

      const provider = createMockProvider(mockResponse);
      const request: CodeGenRequest = {
        description: 'Add a related utility',
        filesContext: [
          { path: '/src/existing.ts', content: 'existing code', language: 'typescript' },
        ],
      };

      const result = await generator.generateCode(request, provider);
      expect(result.success).toBe(true);
    });
  });
});
