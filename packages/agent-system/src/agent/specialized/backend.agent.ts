// ============================================================================
// Backend Agent - API implementation and business logic
// ============================================================================

import { type AIProvider } from '@builder/ai-core';

import { type AgentTask, AgentRole, AgentState, TaskStatus } from '../../types/index.js';
import { BaseAgent, type BaseAgentConfig } from '../base-agent.js';

const BACKEND_SYSTEM_PROMPT = `You are an expert backend developer. Your responsibilities include:
- Implementing RESTful and GraphQL APIs
- Writing business logic and service layers
- Designing authentication and authorization flows
- Implementing data validation and error handling
- Creating middleware and interceptors

When given a task, you MUST respond with ONLY a JSON object in the following format (no additional text):
{
  "operations": [
    {"type": "create", "path": "/src/controllers/example.controller.ts", "content": "...", "language": "typescript"},
    {"type": "update", "path": "/src/services/example.service.ts", "content": "...", "language": "typescript"},
    {"type": "delete", "path": "/src/old-file.ts"}
  ],
  "explanation": "Brief explanation of what was created or changed"
}

Valid operation types: "create", "update", "delete"
Valid languages: "typescript", "javascript", "json", "yaml", "sql"

Ensure each file operation includes the full file content (not just snippets).
Focus on:
1. API endpoint implementations
2. Service layer code
3. Input validation schemas
4. Error handling patterns
5. Authentication/authorization logic`;

const BACKEND_CAPABILITIES = [
  {
    name: 'api_implementation',
    description: 'Implement REST or GraphQL API endpoints',
  },
  {
    name: 'business_logic',
    description: 'Write service-layer business logic and workflows',
  },
  {
    name: 'auth_implementation',
    description: 'Implement authentication and authorization patterns',
  },
  {
    name: 'validation',
    description: 'Create input validation and data transformation logic',
  },
];

export class BackendAgent extends BaseAgent {
  constructor(config: { id: string; provider?: AIProvider; model?: string }) {
    const baseConfig: BaseAgentConfig = {
      id: config.id,
      role: AgentRole.BACKEND,
      systemPrompt: BACKEND_SYSTEM_PROMPT,
      capabilities: BACKEND_CAPABILITIES,
      provider: config.provider,
      model: config.model,
    };
    super(baseConfig);
  }

  canHandle(taskType: string): boolean {
    const handledTypes = [
      'api_implementation',
      'business_logic',
      'backend',
      'auth_implementation',
      'validation',
      'middleware',
    ];
    return handledTypes.includes(taskType);
  }

  async execute(task: AgentTask): Promise<AgentTask> {
    this.setState(AgentState.WORKING);

    try {
      const response = await this.callAI([
        {
          role: 'user',
          content: `Task: ${task.description}\n\nInput:\n${JSON.stringify(task.input, null, 2)}\n\nGenerate the backend implementation.`,
        },
      ]);

      const updatedTask: AgentTask = {
        ...task,
        status: TaskStatus.COMPLETED,
        output: {
          code: response.content,
          model: response.model,
          tokensUsed: response.usage.totalTokens,
        },
        completedAt: new Date(),
      };

      this.setState(AgentState.IDLE);
      await this.storeMemory(response.content, 'short_term', { taskId: task.id, type: 'backend_code' });

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
