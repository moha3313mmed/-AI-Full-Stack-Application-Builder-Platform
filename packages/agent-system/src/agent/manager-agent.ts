// ============================================================================
// ManagerAgent - Coordinates other agents, decomposes tasks, assigns work
// ============================================================================

import { type AIProvider } from '@builder/ai-core';

import { type EventBus } from '../communication/event-bus.js';
import { type ConflictResolver } from '../conflict/resolver.js';
import { TaskDecomposer } from '../task/task-decomposer.js';
import {
  type AgentTask,
  type AgentMessage,
  type ExecutionPlan,
  AgentRole,
  AgentState,
  TaskStatus,
  MessageType,
} from '../types/index.js';

import { BaseAgent, type BaseAgentConfig } from './base-agent.js';

const MANAGER_SYSTEM_PROMPT = `You are the Manager Agent coordinating a team of specialized AI agents. Your responsibilities include:
- Understanding user requests and decomposing them into actionable tasks
- Assigning tasks to the most appropriate specialized agents
- Monitoring progress and handling failures
- Resolving conflicts between agent outputs
- Synthesizing final results from all agent contributions

You have access to specialized agents:
- ARCHITECT: System design and technology selection
- FRONTEND: UI components and client-side logic
- BACKEND: API endpoints and business logic
- DATABASE: Schema design and query optimization
- SECURITY: Vulnerability analysis and secure coding
- TESTING: Test generation and coverage analysis

When assigning tasks, consider:
1. Agent capabilities and specializations
2. Task dependencies and execution order
3. Opportunities for parallel execution
4. Potential conflicts between agents`;

const MANAGER_CAPABILITIES = [
  {
    name: 'task_decomposition',
    description: 'Break down complex requests into manageable tasks',
  },
  {
    name: 'task_assignment',
    description: 'Assign tasks to the most appropriate specialized agents',
  },
  {
    name: 'progress_monitoring',
    description: 'Monitor agent progress and handle failures',
  },
  {
    name: 'conflict_resolution',
    description: 'Resolve conflicts between agent outputs',
  },
  {
    name: 'result_synthesis',
    description: 'Combine agent outputs into a coherent final result',
  },
];

export interface ManagerAgentConfig {
  id: string;
  provider: AIProvider;
  eventBus?: EventBus;
  conflictResolver?: ConflictResolver;
  model?: string;
}

/**
 * ManagerAgent orchestrates the team of specialized agents.
 * It decomposes user requests, assigns work, monitors progress,
 * and resolves conflicts.
 */
export class ManagerAgent extends BaseAgent {
  private taskDecomposer: TaskDecomposer;
  private conflictResolver?: ConflictResolver;
  private activePlans: Map<string, ExecutionPlan> = new Map();
  private taskResults: Map<string, AgentTask> = new Map();

  constructor(config: ManagerAgentConfig) {
    const baseConfig: BaseAgentConfig = {
      id: config.id,
      role: AgentRole.MANAGER,
      systemPrompt: MANAGER_SYSTEM_PROMPT,
      capabilities: MANAGER_CAPABILITIES,
      provider: config.provider,
      eventBus: config.eventBus,
      model: config.model,
    };
    super(baseConfig);

    this.taskDecomposer = new TaskDecomposer({
      provider: config.provider,
      model: config.model,
    });
    this.conflictResolver = config.conflictResolver;
  }

  canHandle(taskType: string): boolean {
    return taskType === 'management' || taskType === 'decomposition' || taskType === 'coordination';
  }

  /**
   * Decompose a user request into an execution plan.
   */
  async decomposeRequest(request: string, context?: Record<string, unknown>): Promise<ExecutionPlan> {
    this.setState(AgentState.WORKING);

    try {
      const plan = await this.taskDecomposer.decompose(request, context);
      this.activePlans.set(plan.id, plan);
      this.setState(AgentState.IDLE);
      return plan;
    } catch (error) {
      this.setState(AgentState.FAILED);
      throw error;
    }
  }

  /**
   * Assign a task to a specific agent via the event bus.
   */
  assignTask(task: AgentTask, targetAgentId: string): void {
    if (!this.eventBus) {
      throw new Error('No event bus configured for ManagerAgent');
    }

    const message: AgentMessage = {
      id: crypto.randomUUID(),
      from: this.id,
      to: targetAgentId,
      type: MessageType.TASK_ASSIGNMENT,
      payload: { task } as unknown as Record<string, unknown>,
      timestamp: new Date(),
      correlationId: task.id,
    };

    this.eventBus.publish(message);
  }

  /**
   * Handle task results from specialized agents.
   */
  handleTaskResult(taskId: string, result: AgentTask): void {
    this.taskResults.set(taskId, result);

    // Check for conflicts with registered outputs
    if (this.conflictResolver && result.output) {
      this.conflictResolver.registerOutput({
        taskId: result.id,
        agentId: result.assignedAgent ?? 'unknown',
        output: result.output,
        outputType: result.type,
      });
    }
  }

  /**
   * Get the results for a plan.
   */
  getPlanResults(planId: string): AgentTask[] {
    const plan = this.activePlans.get(planId);
    if (!plan) return [];

    return plan.tasks
      .map((task) => this.taskResults.get(task.id))
      .filter((t): t is AgentTask => t !== undefined);
  }

  /**
   * Execute a management task (coordinator role).
   */
  async execute(task: AgentTask): Promise<AgentTask> {
    this.setState(AgentState.WORKING);

    try {
      const response = await this.callAI([
        {
          role: 'user',
          content: `Task: ${task.description}\n\nInput:\n${JSON.stringify(task.input, null, 2)}\n\nProvide coordination instructions.`,
        },
      ]);

      const updatedTask: AgentTask = {
        ...task,
        status: TaskStatus.COMPLETED,
        output: {
          instructions: response.content,
          model: response.model,
          tokensUsed: response.usage.totalTokens,
        },
        completedAt: new Date(),
      };

      this.setState(AgentState.IDLE);
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
