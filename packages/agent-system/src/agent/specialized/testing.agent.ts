// ============================================================================
// Testing Agent - Test generation and coverage analysis
// ============================================================================

import { type AIProvider } from '@builder/ai-core';

import { type AgentTask, AgentRole, AgentState, TaskStatus } from '../../types/index.js';
import { BaseAgent, type BaseAgentConfig } from '../base-agent.js';

const TESTING_SYSTEM_PROMPT = `You are an expert test engineer. Your responsibilities include:
- Generating comprehensive unit, integration, and E2E tests
- Analyzing test coverage and identifying gaps
- Creating test fixtures and mocks
- Implementing property-based and snapshot testing
- Designing test strategies for complex features

When given a task, you MUST respond with ONLY a JSON object in the following format (no additional text):
{
  "operations": [
    {"type": "create", "path": "/src/__tests__/example.spec.ts", "content": "...", "language": "typescript"},
    {"type": "create", "path": "/src/__mocks__/service.mock.ts", "content": "...", "language": "typescript"}
  ],
  "explanation": "Brief explanation of test strategy and coverage"
}

Valid operation types: "create", "update", "delete"
Valid languages: "typescript", "javascript", "json"

Ensure each file operation includes the full file content (not just snippets).
Focus on:
1. Test code with proper assertions
2. Mock/stub implementations
3. Test fixtures and data generators
4. Coverage analysis results
5. Testing strategy recommendations`;

const TESTING_CAPABILITIES = [
  {
    name: 'test_generation',
    description: 'Generate unit, integration, and E2E test suites',
  },
  {
    name: 'coverage_analysis',
    description: 'Analyze test coverage and identify untested paths',
  },
  {
    name: 'mock_creation',
    description: 'Create test mocks, stubs, and fixtures',
  },
  {
    name: 'test_strategy',
    description: 'Design comprehensive testing strategies',
  },
];

export class TestingAgent extends BaseAgent {
  constructor(config: { id: string; provider?: AIProvider; model?: string }) {
    const baseConfig: BaseAgentConfig = {
      id: config.id,
      role: AgentRole.TESTING,
      systemPrompt: TESTING_SYSTEM_PROMPT,
      capabilities: TESTING_CAPABILITIES,
      provider: config.provider,
      model: config.model,
    };
    super(baseConfig);
  }

  canHandle(taskType: string): boolean {
    const handledTypes = [
      'test_generation',
      'coverage_analysis',
      'testing',
      'mock_creation',
      'test_strategy',
      'quality_assurance',
    ];
    return handledTypes.includes(taskType);
  }

  async execute(task: AgentTask): Promise<AgentTask> {
    this.setState(AgentState.WORKING);

    try {
      const response = await this.callAI([
        {
          role: 'user',
          content: `Task: ${task.description}\n\nInput:\n${JSON.stringify(task.input, null, 2)}\n\nGenerate the test implementation.`,
        },
      ]);

      const updatedTask: AgentTask = {
        ...task,
        status: TaskStatus.COMPLETED,
        output: {
          tests: response.content,
          model: response.model,
          tokensUsed: response.usage.totalTokens,
        },
        completedAt: new Date(),
      };

      this.setState(AgentState.IDLE);
      await this.storeMemory(response.content, 'short_term', { taskId: task.id, type: 'test_code' });

      return updatedTask;
    } catch (error) {
      this.setState(AgentState.FAILED);
      return {
        ...task,
        status: TaskStatus.FAILED,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
