// ============================================================================
// Database Agent - Schema design, query optimization, migrations
// ============================================================================

import { type AIProvider } from '@builder/ai-core';

import { type AgentTask, AgentRole, AgentState, TaskStatus } from '../../types/index.js';
import { BaseAgent, type BaseAgentConfig } from '../base-agent.js';

const DATABASE_SYSTEM_PROMPT = `You are an expert database engineer. Your responsibilities include:
- Designing normalized database schemas
- Writing efficient queries and stored procedures
- Creating database migrations
- Optimizing query performance with indexes
- Designing data models for different storage engines

When given a task, you MUST respond with ONLY a JSON object in the following format (no additional text):
{
  "operations": [
    {"type": "create", "path": "/prisma/schema.prisma", "content": "...", "language": "prisma"},
    {"type": "create", "path": "/migrations/001_initial.sql", "content": "...", "language": "sql"}
  ],
  "explanation": "Brief explanation of schema decisions and rationale"
}

Valid operation types: "create", "update", "delete"
Valid languages: "typescript", "sql", "prisma", "json", "yaml"

Ensure each file operation includes the full file content (not just snippets).
Focus on:
1. Schema definitions (SQL/Prisma)
2. Migration scripts
3. Index recommendations
4. Query implementations
5. Data integrity constraints`;

const DATABASE_CAPABILITIES = [
  {
    name: 'schema_design',
    description: 'Design database schemas with proper normalization and relationships',
  },
  {
    name: 'query_optimization',
    description: 'Optimize database queries and suggest indexes',
  },
  {
    name: 'migration_creation',
    description: 'Create database migration scripts',
  },
  {
    name: 'data_modeling',
    description: 'Design data models for various storage engines',
  },
];

export class DatabaseAgent extends BaseAgent {
  constructor(config: { id: string; provider?: AIProvider; model?: string }) {
    const baseConfig: BaseAgentConfig = {
      id: config.id,
      role: AgentRole.DATABASE,
      systemPrompt: DATABASE_SYSTEM_PROMPT,
      capabilities: DATABASE_CAPABILITIES,
      provider: config.provider,
      model: config.model,
    };
    super(baseConfig);
  }

  canHandle(taskType: string): boolean {
    const handledTypes = [
      'schema_design',
      'query_optimization',
      'database',
      'migration',
      'data_modeling',
      'indexing',
    ];
    return handledTypes.includes(taskType);
  }

  async execute(task: AgentTask): Promise<AgentTask> {
    this.setState(AgentState.WORKING);

    try {
      const response = await this.callAI([
        {
          role: 'user',
          content: `Task: ${task.description}\n\nInput:\n${JSON.stringify(task.input, null, 2)}\n\nGenerate the database implementation.`,
        },
      ]);

      const updatedTask: AgentTask = {
        ...task,
        status: TaskStatus.COMPLETED,
        output: {
          schema: response.content,
          model: response.model,
          tokensUsed: response.usage.totalTokens,
        },
        completedAt: new Date(),
      };

      this.setState(AgentState.IDLE);
      await this.storeMemory(response.content, 'long_term', { taskId: task.id, type: 'database_schema' });

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
