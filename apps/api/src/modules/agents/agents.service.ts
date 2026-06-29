import {
  AgentOrchestrator,
  BackendAgent,
  FrontendAgent,
  TaskPriority,
  TaskStatus,
} from '@builder/agent-system';
import type { AgentTask, TaskExecutionResult } from '@builder/agent-system';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { AiService } from '../ai/ai.service';

import { AgentsGateway } from './agents.gateway';
import { TriggerAgentDto } from './dto/trigger-agent.dto';

export interface AgentWorkflowResult {
  workflowId: string;
  userId: string;
  status: 'started' | 'completed' | 'failed';
  message: string;
  result?: TaskExecutionResult;
}

@Injectable()
export class AgentsService implements OnModuleInit {
  private readonly logger = new Logger(AgentsService.name);
  private readonly orchestrator: AgentOrchestrator;
  private readonly workflowOwners = new Map<string, string>();

  constructor(
    private readonly gateway: AgentsGateway,
    private readonly aiService: AiService,
  ) {
    this.orchestrator = new AgentOrchestrator({
      maxConcurrentTasks: 5,
      taskTimeout: 120000,
      retryAttempts: 3,
    });
  }

  onModuleInit(): void {
    // Wire up back-reference to resolve circular dependency
    this.gateway.setAgentsService(this);

    // Get the first available provider from the registry
    const availableProviders = this.aiService.getAvailableProviders();
    const provider = availableProviders.length > 0
      ? this.aiService.getProvider(availableProviders[0])
      : undefined;

    if (provider) {
      this.logger.log(`Assigning AI provider "${availableProviders[0]}" to agents`);
    } else {
      this.logger.warn('No AI provider available for agents. Agent task execution will fail.');
    }

    // Register specialized agents with the provider
    this.orchestrator.registerAgent(
      new FrontendAgent({ id: 'frontend-agent-1', provider }),
    );

    this.orchestrator.registerAgent(
      new BackendAgent({ id: 'backend-agent-1', provider }),
    );
  }

  async triggerWorkflow(dto: TriggerAgentDto, userId: string): Promise<AgentWorkflowResult> {
    const workflowId = `wf_${Date.now()}`;
    this.logger.log(`Triggering agent workflow: ${workflowId} for task: ${dto.task}`);

    // Track workflow ownership
    this.workflowOwners.set(workflowId, userId);

    // Emit started event to connected WebSocket clients
    this.gateway.emitProgress(workflowId, {
      workflowId,
      status: 'started',
      task: dto.task,
    });

    // Create a task and submit it to the orchestrator
    const task: AgentTask = {
      id: workflowId,
      type: dto.context?.type as string || 'backend',
      description: dto.task,
      input: { task: dto.task, projectId: dto.projectId, ...dto.context },
      status: TaskStatus.PENDING,
      dependencies: [],
      priority: TaskPriority.HIGH,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
    };

    // Execute asynchronously and emit progress events
    this.orchestrator
      .submitTask(task)
      .then((result) => {
        if (result.status === TaskStatus.COMPLETED) {
          this.gateway.emitComplete(workflowId, {
            workflowId,
            status: 'completed',
            output: result.output,
          });
        } else {
          this.gateway.emitError(workflowId, {
            workflowId,
            status: 'failed',
            error: result.error || 'Task execution failed',
          });
        }
      })
      .catch((error: Error) => {
        this.gateway.emitError(workflowId, {
          workflowId,
          status: 'failed',
          error: error.message,
        });
      });

    return {
      workflowId,
      userId,
      status: 'started',
      message: `Workflow ${workflowId} has been initiated for task: ${dto.task}`,
    };
  }

  async getWorkflowStatus(workflowId: string): Promise<AgentWorkflowResult> {
    const taskStatus = this.orchestrator.getTaskStatus(workflowId);
    const userId = this.workflowOwners.get(workflowId) || '';

    if (taskStatus) {
      const status = taskStatus.status === TaskStatus.COMPLETED
        ? 'completed'
        : taskStatus.status === TaskStatus.FAILED
          ? 'failed'
          : 'started';

      return {
        workflowId,
        userId,
        status,
        message: `Workflow ${workflowId} is ${status}`,
      };
    }

    return {
      workflowId,
      userId,
      status: 'started',
      message: `Workflow ${workflowId} is in progress`,
    };
  }

  isWorkflowOwner(workflowId: string, userId: string): boolean {
    const owner = this.workflowOwners.get(workflowId);
    // If no owner is tracked (e.g., workflow not found), deny access
    if (!owner) return false;
    return owner === userId;
  }
}
