import {
  AgentOrchestrator,
  ArchitectAgent,
  BackendAgent,
  DatabaseAgent,
  FrontendAgent,
  ManagerAgent,
  MessageType,
  OutputMerger,
  SecurityAgent,
  TestingAgent,
} from '@builder/agent-system';
import type {
  AgentFileOutput,
  ExecutionPlan,
  MergeableFileOperation,
  MergeConflict,
  TaskExecutionResult,
} from '@builder/agent-system';
import type { AIProvider } from '@builder/ai-core';
import { Injectable, Logger } from '@nestjs/common';

import { AiService } from '../ai/ai.service';

import { WorkflowGateway } from './workflow.gateway';

/**
 * Result produced by the parallel execution engine.
 */
export interface ParallelExecutionResult {
  /** Whether the overall execution succeeded */
  success: boolean;
  /** Merged file operations from all agents */
  operations: MergeableFileOperation[];
  /** Human-readable explanation of all changes */
  explanation: string;
  /** Conflicts detected during output merging */
  conflicts: MergeConflict[];
  /** Underlying orchestrator execution result */
  executionResult: TaskExecutionResult;
  /** IDs of agents that participated */
  agentIds: string[];
}

/**
 * ParallelExecutionService wraps the AgentOrchestrator to provide
 * a high-level interface for parallel multi-agent execution within
 * the NestJS workflow pipeline.
 *
 * It handles:
 * - Request decomposition via ManagerAgent
 * - Agent registration with AI providers
 * - DAG-based parallel execution
 * - Output collection and conflict resolution
 * - WebSocket progress events per agent
 */
@Injectable()
export class ParallelExecutionService {
  private readonly logger = new Logger(ParallelExecutionService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly gateway: WorkflowGateway,
  ) {}

  /**
   * Execute a complex request through the parallel multi-agent pipeline.
   *
   * Steps:
   * 1. Create ManagerAgent and decompose the request into an ExecutionPlan
   * 2. Register specialized agents with AI providers
   * 3. Execute the plan in parallel via AgentOrchestrator
   * 4. Collect and merge outputs from all agents
   * 5. Emit progress events throughout
   */
  async execute(
    projectId: string,
    request: string,
    context?: Record<string, unknown>,
  ): Promise<ParallelExecutionResult> {
    const provider = this.getAIProvider();

    // Create orchestrator and configure
    const orchestrator = new AgentOrchestrator({
      maxConcurrentTasks: 5,
      taskTimeout: 120000,
      retryAttempts: 2,
    });

    try {
      // Step 1: Create ManagerAgent and decompose request
      this.gateway.emitAgentStarted(projectId, {
        agentRole: 'MANAGER',
        taskDescription: 'Decomposing request into subtasks',
      });

      const manager = new ManagerAgent({
        id: 'manager-agent',
        provider,
        model: 'gpt-4',
      });

      const plan = await manager.decomposeRequest(request, {
        projectId,
        ...context,
      });

      this.logger.log(
        `Decomposed request into ${plan.tasks.length} tasks with ${plan.parallelizableGroups.length} parallel groups`,
      );

      this.gateway.emitAgentCompleted(projectId, {
        agentRole: 'MANAGER',
        result: {
          taskCount: plan.tasks.length,
          parallelGroups: plan.parallelizableGroups.length,
        },
      });

      // Step 2: Register specialized agents
      const agents = this.registerAgents(orchestrator, provider);

      // Step 3: Emit plan progress and execute
      this.gateway.emitPlanProgress(projectId, {
        completedTasks: 0,
        totalTasks: plan.tasks.length,
        parallelGroup: 0,
      });

      // Set up per-agent progress tracking
      const unsubscribeProgress = this.setupProgressTracking(orchestrator, projectId, plan);

      const executionResult = await orchestrator.executePlan(plan);

      // Clean up event-bus listeners
      unsubscribeProgress();

      // Step 4: Collect and merge outputs
      const mergeResult = this.mergeAgentOutputs(plan, executionResult);

      // Step 5: Final progress emission
      this.gateway.emitPlanProgress(projectId, {
        completedTasks: plan.tasks.length,
        totalTasks: plan.tasks.length,
        parallelGroup: plan.parallelizableGroups.length - 1,
      });

      return {
        success: executionResult.success,
        operations: mergeResult.operations,
        explanation: mergeResult.explanation,
        conflicts: mergeResult.conflicts,
        executionResult,
        agentIds: agents,
      };
    } finally {
      orchestrator.dispose();
    }
  }

  /**
   * Decompose a request without executing it.
   * Useful for previewing what the parallel engine would do.
   */
  async decompose(
    request: string,
    context?: Record<string, unknown>,
  ): Promise<ExecutionPlan> {
    const provider = this.getAIProvider();
    const manager = new ManagerAgent({
      id: 'manager-preview',
      provider,
      model: 'gpt-4',
    });
    return manager.decomposeRequest(request, context);
  }

  /**
   * Get the first available AI provider.
   */
  private getAIProvider() {
    const availableProviders = this.aiService.getAvailableProviders();
    if (availableProviders.length === 0) {
      throw new Error('No AI provider available for parallel execution');
    }

    const provider = this.aiService.getProvider(availableProviders[0]);
    if (!provider) {
      throw new Error(`AI provider "${availableProviders[0]}" could not be initialized`);
    }
    return provider;
  }

  /**
   * Register all specialized agents with the orchestrator.
   */
  private registerAgents(orchestrator: AgentOrchestrator, provider: AIProvider): string[] {
    const agentConfigs = [
      { id: 'frontend-agent', AgentClass: FrontendAgent },
      { id: 'backend-agent', AgentClass: BackendAgent },
      { id: 'database-agent', AgentClass: DatabaseAgent },
      { id: 'architect-agent', AgentClass: ArchitectAgent },
      { id: 'security-agent', AgentClass: SecurityAgent },
      { id: 'testing-agent', AgentClass: TestingAgent },
    ];

    const registeredIds: string[] = [];

    for (const { id, AgentClass } of agentConfigs) {
      const agent = new AgentClass({ id, provider });
      orchestrator.registerAgent(agent);
      registeredIds.push(id);
    }

    return registeredIds;
  }

  /**
   * Set up WebSocket progress tracking for the plan execution.
   * Returns an unsubscribe function to clean up event listeners.
   */
  private setupProgressTracking(
    orchestrator: AgentOrchestrator,
    projectId: string,
    plan: ExecutionPlan,
  ): () => void {
    const eventBus = orchestrator.getEventBus();
    let completedCount = 0;

    // Listen for task result events via the event bus
    const unsubTaskResult = eventBus.subscribe(MessageType.TASK_RESULT, (message) => {
      const task = plan.tasks.find((t) => t.id === message.correlationId);
      if (task) {
        completedCount++;
        const agentRole = task.type.toUpperCase();

        this.gateway.emitAgentProgress(projectId, {
          agentRole,
          status: 'completed',
          filesGenerated: [],
        });

        this.gateway.emitPlanProgress(projectId, {
          completedTasks: completedCount,
          totalTasks: plan.tasks.length,
          parallelGroup: this.findGroupIndex(plan, task.id),
        });
      }
    });

    // Also listen for status updates
    const unsubStatusUpdate = eventBus.subscribe(MessageType.STATUS_UPDATE, (message) => {
      const task = plan.tasks.find((t) => t.id === message.correlationId);
      if (task) {
        const agentRole = task.type.toUpperCase();
        this.gateway.emitAgentProgress(projectId, {
          agentRole,
          status: 'in_progress',
          filesGenerated: [],
        });
      }
    });

    // Return cleanup function
    return () => {
      unsubTaskResult();
      unsubStatusUpdate();
    };
  }

  /**
   * Find which parallel group a task belongs to.
   */
  private findGroupIndex(plan: ExecutionPlan, taskId: string): number {
    for (let i = 0; i < plan.parallelizableGroups.length; i++) {
      if (plan.parallelizableGroups[i].includes(taskId)) {
        return i;
      }
    }
    return 0;
  }

  /**
   * Merge outputs from all completed agents into a unified set of file operations.
   */
  private mergeAgentOutputs(
    plan: ExecutionPlan,
    executionResult: TaskExecutionResult,
  ): { operations: MergeableFileOperation[]; explanation: string; conflicts: MergeConflict[] } {
    const merger = new OutputMerger({ strategy: 'last-writer-wins' });
    const agentOutputs: AgentFileOutput[] = [];

    for (const task of executionResult.tasks) {
      if (task.output && task.output.code) {
        const operations = this.parseAgentOutput(task.output.code as string);
        if (operations.length > 0) {
          agentOutputs.push({
            agentId: task.assignedAgent ?? 'unknown',
            taskId: task.id,
            operations,
            explanation: this.extractExplanation(task.output.code as string),
          });
        }
      }
    }

    const result = merger.merge(agentOutputs);
    return {
      operations: result.operations,
      explanation: result.explanation,
      conflicts: result.conflicts,
    };
  }

  /**
   * Parse the JSON output from an agent into file operations.
   * Agents return JSON with { operations: [...], explanation: "..." }
   */
  private parseAgentOutput(code: string): MergeableFileOperation[] {
    try {
      let jsonStr = code.trim();

      // Strip markdown code blocks if present
      if (jsonStr.startsWith('```')) {
        const lines = jsonStr.split('\n');
        lines.shift();
        if (lines[lines.length - 1]?.trim() === '```') {
          lines.pop();
        }
        jsonStr = lines.join('\n').trim();
      }

      const parsed = JSON.parse(jsonStr);

      if (Array.isArray(parsed.operations)) {
        return parsed.operations.map((op: Record<string, unknown>) => ({
          type: op.type as string,
          path: op.path as string,
          content: op.content as string | undefined,
          language: op.language as string | undefined,
        }));
      }

      return [];
    } catch {
      // If output is not valid JSON, return empty
      return [];
    }
  }

  /**
   * Extract the explanation from agent JSON output.
   */
  private extractExplanation(code: string): string | undefined {
    try {
      let jsonStr = code.trim();
      if (jsonStr.startsWith('```')) {
        const lines = jsonStr.split('\n');
        lines.shift();
        if (lines[lines.length - 1]?.trim() === '```') {
          lines.pop();
        }
        jsonStr = lines.join('\n').trim();
      }
      const parsed = JSON.parse(jsonStr);
      return parsed.explanation as string | undefined;
    } catch {
      return undefined;
    }
  }
}
