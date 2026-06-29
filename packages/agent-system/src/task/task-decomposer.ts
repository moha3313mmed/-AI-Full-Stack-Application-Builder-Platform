// ============================================================================
// TaskDecomposer - Decomposes user requests into execution plans (DAGs)
// ============================================================================

import { type AIProvider, type AICompletionRequest } from '@builder/ai-core';

import {
  type AgentTask,
  type ExecutionPlan,
  TaskStatus,
  TaskPriority,
} from '../types/index.js';

const DECOMPOSITION_PROMPT = `You are a task decomposition expert. Given a user request for building software, decompose it into a structured set of tasks that can be assigned to specialized agents.

Available agent roles:
- ARCHITECT: System design, tech selection, architecture decisions
- FRONTEND: UI components, styling, client-side logic
- BACKEND: API endpoints, business logic, services
- DATABASE: Schema design, queries, migrations
- SECURITY: Vulnerability analysis, secure coding
- TESTING: Test generation, coverage analysis

Rules:
1. Each task should be assignable to exactly one agent role
2. Identify dependencies between tasks (what must complete before what)
3. Maximize parallelism - tasks without dependencies should run concurrently
4. Estimate complexity on a 1-10 scale

Respond in this exact JSON format:
{
  "description": "Brief summary of the execution plan",
  "tasks": [
    {
      "type": "task_type",
      "description": "What needs to be done",
      "role": "AGENT_ROLE",
      "dependencies": [],
      "priority": "HIGH|MEDIUM|LOW",
      "complexity": 5
    }
  ],
  "estimatedComplexity": 7
}`;

/**
 * TaskDecomposer analyzes user requests and produces execution plans
 * as directed acyclic graphs (DAGs) of tasks with dependencies.
 */
export class TaskDecomposer {
  private provider: AIProvider;
  private model: string;

  constructor(config: { provider: AIProvider; model?: string }) {
    this.provider = config.provider;
    this.model = config.model ?? 'gpt-4';
  }

  /**
   * Decompose a user request into an execution plan.
   */
  async decompose(request: string, context?: Record<string, unknown>): Promise<ExecutionPlan> {
    const messages = [
      { role: 'system' as const, content: DECOMPOSITION_PROMPT },
      {
        role: 'user' as const,
        content: context
          ? `Request: ${request}\n\nContext: ${JSON.stringify(context, null, 2)}`
          : `Request: ${request}`,
      },
    ];

    const aiRequest: AICompletionRequest = {
      messages,
      model: this.model,
      temperature: 0.3,
      maxTokens: 4096,
    };

    const response = await this.provider.complete(aiRequest);
    return this.parseDecompositionResponse(response.content);
  }

  /**
   * Parse the AI response into a structured ExecutionPlan.
   */
  private parseDecompositionResponse(content: string): ExecutionPlan {
    try {
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in decomposition response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        description: string;
        tasks: Array<{
          type: string;
          description: string;
          role: string;
          dependencies: number[];
          priority: string;
          complexity: number;
        }>;
        estimatedComplexity: number;
      };

      const planId = crypto.randomUUID();
      const tasks: AgentTask[] = parsed.tasks.map((rawTask, index) => ({
        id: `${planId}-task-${index}`,
        type: rawTask.type,
        description: rawTask.description,
        input: {},
        status: TaskStatus.PENDING,
        dependencies: (rawTask.dependencies ?? []).map((dep: number) => `${planId}-task-${dep}`),
        priority: this.mapPriority(rawTask.priority),
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
      }));

      // Identify parallelizable groups (tasks with no mutual dependencies)
      const parallelizableGroups = this.findParallelGroups(tasks);

      return {
        id: planId,
        description: parsed.description,
        tasks,
        estimatedComplexity: parsed.estimatedComplexity ?? 5,
        parallelizableGroups,
      };
    } catch {
      // Fallback: create a single task if parsing fails
      const planId = crypto.randomUUID();
      return {
        id: planId,
        description: 'Single task execution',
        tasks: [
          {
            id: `${planId}-task-0`,
            type: 'general',
            description: content,
            input: {},
            status: TaskStatus.PENDING,
            dependencies: [],
            priority: TaskPriority.MEDIUM,
            retryCount: 0,
            maxRetries: 3,
            createdAt: new Date(),
          },
        ],
        estimatedComplexity: 5,
        parallelizableGroups: [[`${planId}-task-0`]],
      };
    }
  }

  /**
   * Find groups of tasks that can execute in parallel.
   */
  private findParallelGroups(tasks: AgentTask[]): string[][] {
    const groups: string[][] = [];
    const scheduled = new Set<string>();

    while (scheduled.size < tasks.length) {
      const group: string[] = [];
      for (const task of tasks) {
        if (scheduled.has(task.id)) continue;
        const depsResolved = task.dependencies.every((dep) => scheduled.has(dep));
        if (depsResolved) {
          group.push(task.id);
        }
      }
      if (group.length === 0) break; // Deadlock or circular dependency
      for (const id of group) {
        scheduled.add(id);
      }
      groups.push(group);
    }

    return groups;
  }

  /**
   * Map a priority string to the TaskPriority enum.
   */
  private mapPriority(priority: string): TaskPriority {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL':
        return TaskPriority.CRITICAL;
      case 'HIGH':
        return TaskPriority.HIGH;
      case 'LOW':
        return TaskPriority.LOW;
      default:
        return TaskPriority.MEDIUM;
    }
  }
}
