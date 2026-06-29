// ============================================================================
// Architect Agent - System design and technology selection
// ============================================================================

import { type AIProvider } from '@builder/ai-core';

import { type AgentTask, AgentRole, AgentState, TaskStatus } from '../../types/index.js';
import { BaseAgent, type BaseAgentConfig } from '../base-agent.js';

const ARCHITECT_SYSTEM_PROMPT = `You are an expert software architect. Your responsibilities include:
- Designing system architecture and component interactions
- Selecting appropriate technologies, frameworks, and patterns
- Defining API contracts and data models
- Creating scalable, maintainable architecture decisions
- Identifying potential technical risks and mitigation strategies

When given a task, you MUST respond with ONLY a JSON object in the following format (no additional text):
{
  "operations": [
    {"type": "create", "path": "/docs/architecture.md", "content": "...", "language": "markdown"},
    {"type": "create", "path": "/src/types/api.ts", "content": "...", "language": "typescript"}
  ],
  "explanation": "Brief explanation of architecture decisions and rationale"
}

Valid operation types: "create", "update", "delete"
Valid languages: "typescript", "javascript", "json", "yaml", "markdown"

Ensure each file operation includes the full file content (not just snippets).
Focus on:
1. Architecture decisions with rationale
2. Component diagram descriptions
3. Technology recommendations
4. Interface definitions
5. Non-functional requirements considerations`;

const ARCHITECT_CAPABILITIES = [
  {
    name: 'system_design',
    description: 'Design system architecture including component interactions and data flow',
  },
  {
    name: 'technology_selection',
    description: 'Select appropriate technologies, frameworks, and libraries',
  },
  {
    name: 'api_design',
    description: 'Design API contracts, endpoints, and data models',
  },
  {
    name: 'pattern_selection',
    description: 'Choose appropriate design patterns and architectural styles',
  },
];

export class ArchitectAgent extends BaseAgent {
  constructor(config: { id: string; provider?: AIProvider; model?: string }) {
    const baseConfig: BaseAgentConfig = {
      id: config.id,
      role: AgentRole.ARCHITECT,
      systemPrompt: ARCHITECT_SYSTEM_PROMPT,
      capabilities: ARCHITECT_CAPABILITIES,
      provider: config.provider,
      model: config.model,
    };
    super(baseConfig);
  }

  canHandle(taskType: string): boolean {
    const handledTypes = [
      'system_design',
      'architecture',
      'technology_selection',
      'api_design',
      'pattern_selection',
      'tech_stack',
    ];
    return handledTypes.includes(taskType);
  }

  async execute(task: AgentTask): Promise<AgentTask> {
    this.setState(AgentState.WORKING);

    try {
      const response = await this.callAI([
        {
          role: 'user',
          content: `Task: ${task.description}\n\nInput:\n${JSON.stringify(task.input, null, 2)}\n\nProvide a detailed architecture plan.`,
        },
      ]);

      const updatedTask: AgentTask = {
        ...task,
        status: TaskStatus.COMPLETED,
        output: {
          architectureDecision: response.content,
          model: response.model,
          tokensUsed: response.usage.totalTokens,
        },
        completedAt: new Date(),
      };

      this.setState(AgentState.IDLE);
      await this.storeMemory(response.content, 'long_term', { taskId: task.id, type: 'architecture_decision' });

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
