// ============================================================================
// Frontend Agent - UI code generation and component creation
// ============================================================================

import { type AIProvider } from '@builder/ai-core';

import { type AgentTask, AgentRole, AgentState, TaskStatus } from '../../types/index.js';
import { BaseAgent, type BaseAgentConfig } from '../base-agent.js';

const FRONTEND_SYSTEM_PROMPT = `You are an expert frontend developer. Your responsibilities include:
- Generating React/Next.js components with TypeScript
- Creating responsive, accessible UI implementations
- Implementing state management patterns
- Writing CSS/Tailwind styles
- Handling client-side routing and data fetching

When given a task, you MUST respond with ONLY a JSON object in the following format (no additional text):
{
  "operations": [
    {"type": "create", "path": "/src/components/Example.tsx", "content": "...", "language": "typescriptreact"},
    {"type": "update", "path": "/src/App.tsx", "content": "...", "language": "typescriptreact"},
    {"type": "delete", "path": "/src/old-file.ts"}
  ],
  "explanation": "Brief explanation of what was created or changed"
}

Valid operation types: "create", "update", "delete"
Valid languages: "typescript", "typescriptreact", "javascript", "css", "html", "json"

Ensure each file operation includes the full file content (not just snippets).
Focus on:
1. Component code with proper TypeScript types
2. Styling implementation
3. State management logic
4. Accessibility considerations
5. Performance optimizations`;

const FRONTEND_CAPABILITIES = [
  {
    name: 'component_creation',
    description: 'Create React components with TypeScript and proper styling',
  },
  {
    name: 'ui_implementation',
    description: 'Implement user interfaces from design specifications',
  },
  {
    name: 'state_management',
    description: 'Implement client-side state management patterns',
  },
  {
    name: 'responsive_design',
    description: 'Create responsive layouts that work across devices',
  },
];

export class FrontendAgent extends BaseAgent {
  constructor(config: { id: string; provider?: AIProvider; model?: string }) {
    const baseConfig: BaseAgentConfig = {
      id: config.id,
      role: AgentRole.FRONTEND,
      systemPrompt: FRONTEND_SYSTEM_PROMPT,
      capabilities: FRONTEND_CAPABILITIES,
      provider: config.provider,
      model: config.model,
    };
    super(baseConfig);
  }

  canHandle(taskType: string): boolean {
    const handledTypes = [
      'component_creation',
      'ui_implementation',
      'frontend',
      'styling',
      'state_management',
      'responsive_design',
    ];
    return handledTypes.includes(taskType);
  }

  async execute(task: AgentTask): Promise<AgentTask> {
    this.setState(AgentState.WORKING);

    try {
      const response = await this.callAI([
        {
          role: 'user',
          content: `Task: ${task.description}\n\nInput:\n${JSON.stringify(task.input, null, 2)}\n\nGenerate the frontend implementation.`,
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
      await this.storeMemory(response.content, 'short_term', { taskId: task.id, type: 'frontend_code' });

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
