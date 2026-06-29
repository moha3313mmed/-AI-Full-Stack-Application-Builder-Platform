// ============================================================================
// AgentOrchestrator - Manages agent pool, routes messages, executes tasks
// ============================================================================

import { BaseAgent } from './agent/base-agent.js';
import { EventBus } from './communication/event-bus.js';
import { ConflictResolver } from './conflict/resolver.js';
import { TaskQueue } from './task/task-queue.js';
import {
  type AgentTask,
  type OrchestratorConfig,
  type ExecutionPlan,
  AgentRole,
  AgentState,
  TaskStatus,
} from './types/index.js';

export interface TaskExecutionResult {
  planId: string;
  tasks: AgentTask[];
  success: boolean;
  errors: string[];
  duration: number;
}

/**
 * AgentOrchestrator manages the agent pool, routes messages between agents,
 * tracks task execution DAGs, and handles parallel execution.
 * Implements timeout and circuit breaker patterns.
 */
export class AgentOrchestrator {
  private agents: Map<string, BaseAgent> = new Map();
  private agentsByRole: Map<AgentRole, BaseAgent[]> = new Map();
  private taskQueue: TaskQueue;
  private eventBus: EventBus;
  private conflictResolver: ConflictResolver;
  private config: OrchestratorConfig;
  private activeTasks: Map<string, { task: AgentTask; startTime: number; timeout: ReturnType<typeof setTimeout> }> =
    new Map();
  private taskResults: Map<string, AgentTask> = new Map();
  private circuitBreaker: Map<string, { failures: number; lastFailure: number; open: boolean }> = new Map();
  private completionNotifier: (() => void) | null = null;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = {
      maxConcurrentTasks: config?.maxConcurrentTasks ?? 5,
      taskTimeout: config?.taskTimeout ?? 60000,
      retryAttempts: config?.retryAttempts ?? 3,
      circuitBreakerThreshold: config?.circuitBreakerThreshold ?? 5,
      circuitBreakerResetTime: config?.circuitBreakerResetTime ?? 60000,
    };
    this.taskQueue = new TaskQueue();
    this.eventBus = new EventBus();
    this.conflictResolver = new ConflictResolver(this.eventBus);
  }

  /**
   * Register an agent with the orchestrator.
   */
  registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.id, agent);
    const roleAgents = this.agentsByRole.get(agent.role) ?? [];
    roleAgents.push(agent);
    this.agentsByRole.set(agent.role, roleAgents);
    agent.register(this.eventBus);
  }

  /**
   * Unregister an agent from the orchestrator.
   */
  unregisterAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.unregister();
      this.agents.delete(agentId);
      const roleAgents = this.agentsByRole.get(agent.role) ?? [];
      const index = roleAgents.findIndex((a) => a.id === agentId);
      if (index !== -1) roleAgents.splice(index, 1);
    }
  }

  /**
   * Get the event bus instance.
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Get the conflict resolver instance.
   */
  getConflictResolver(): ConflictResolver {
    return this.conflictResolver;
  }

  /**
   * Execute an entire plan, respecting dependencies and enabling parallelism.
   */
  async executePlan(plan: ExecutionPlan): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    // Enqueue all tasks
    this.taskQueue.enqueueBatch(plan.tasks);

    // Process tasks respecting dependency order
    while (!this.taskQueue.isEmpty || this.activeTasks.size > 0) {
      // Start ready tasks up to concurrency limit
      while (this.activeTasks.size < this.config.maxConcurrentTasks) {
        const task = this.taskQueue.dequeue();
        if (!task) break;
        await this.startTask(task);
      }

      // Wait for at least one task to complete if we're at capacity or no more ready
      if (this.activeTasks.size > 0) {
        await this.waitForNextCompletion();
      } else {
        // Check for deadlock
        if (this.taskQueue.detectDeadlock()) {
          errors.push('Deadlock detected: circular dependency in task graph');
          break;
        }
        break;
      }
    }

    const results = plan.tasks.map((t) => this.taskResults.get(t.id) ?? t);
    const success = results.every((t) => t.status === TaskStatus.COMPLETED);

    return {
      planId: plan.id,
      tasks: results,
      success,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Submit a single task for execution.
   */
  async submitTask(task: AgentTask): Promise<AgentTask> {
    const agent = this.findAgentForTask(task);
    if (!agent) {
      return { ...task, status: TaskStatus.FAILED, error: `No agent found for task type: ${task.type}` };
    }

    if (this.isCircuitOpen(agent.id)) {
      return { ...task, status: TaskStatus.FAILED, error: `Circuit breaker open for agent: ${agent.id}` };
    }

    task.assignedAgent = agent.id;
    task.status = TaskStatus.IN_PROGRESS;
    task.startedAt = new Date();

    try {
      const result = await this.executeWithTimeout(agent, task);
      this.recordSuccess(agent.id);
      this.taskResults.set(task.id, result);
      return result;
    } catch (error) {
      this.recordFailure(agent.id);
      const failedTask: AgentTask = {
        ...task,
        status: TaskStatus.FAILED,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      this.taskResults.set(task.id, failedTask);
      return failedTask;
    }
  }

  /**
   * Get the status of a task.
   */
  getTaskStatus(taskId: string): AgentTask | undefined {
    return this.taskResults.get(taskId);
  }

  /**
   * Get all registered agents.
   */
  getAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by role.
   */
  getAgentsByRole(role: AgentRole): BaseAgent[] {
    return this.agentsByRole.get(role) ?? [];
  }

  /**
   * Dispose the orchestrator and cleanup resources.
   */
  dispose(): void {
    for (const { timeout } of this.activeTasks.values()) {
      clearTimeout(timeout);
    }
    this.activeTasks.clear();
    for (const agent of this.agents.values()) {
      agent.unregister();
    }
    this.eventBus.dispose();
  }

  /**
   * Find the best agent to handle a given task.
   */
  private findAgentForTask(task: AgentTask): BaseAgent | undefined {
    // Find agent by capability match
    for (const agent of this.agents.values()) {
      if (agent.canHandle(task.type) && agent.getState() === AgentState.IDLE) {
        return agent;
      }
    }
    // If no idle agent, find any capable agent
    for (const agent of this.agents.values()) {
      if (agent.canHandle(task.type)) {
        return agent;
      }
    }
    return undefined;
  }

  /**
   * Start executing a task.
   */
  private async startTask(task: AgentTask): Promise<void> {
    const agent = this.findAgentForTask(task);
    if (!agent) {
      task.status = TaskStatus.FAILED;
      task.error = `No agent available for task type: ${task.type}`;
      this.taskResults.set(task.id, task);
      this.taskQueue.markFailed(task.id);
      return;
    }

    task.assignedAgent = agent.id;
    task.status = TaskStatus.IN_PROGRESS;
    task.startedAt = new Date();

    const timeout = setTimeout(() => {
      this.handleTaskTimeout(task.id);
    }, this.config.taskTimeout);

    this.activeTasks.set(task.id, { task, startTime: Date.now(), timeout });

    // Execute asynchronously
    agent
      .execute(task)
      .then((result) => {
        this.handleTaskCompletion(task.id, result);
      })
      .catch((error: Error) => {
        this.handleTaskFailure(task.id, error);
      });
  }

  /**
   * Handle successful task completion.
   */
  private handleTaskCompletion(taskId: string, result: AgentTask): void {
    const active = this.activeTasks.get(taskId);
    if (active) {
      clearTimeout(active.timeout);
      this.activeTasks.delete(taskId);
    }

    this.taskResults.set(taskId, result);

    if (result.status === TaskStatus.COMPLETED) {
      this.taskQueue.markCompleted(taskId);
      if (result.assignedAgent) {
        this.recordSuccess(result.assignedAgent);
      }
    } else {
      this.taskQueue.markFailed(taskId);
      if (result.assignedAgent) {
        this.recordFailure(result.assignedAgent);
      }
    }

    // Check for conflicts
    if (result.output && result.assignedAgent) {
      this.conflictResolver.registerOutput({
        taskId,
        agentId: result.assignedAgent,
        output: result.output,
        outputType: result.type,
      });
    }

    // Notify any waiting executePlan loop
    if (this.completionNotifier) {
      const notify = this.completionNotifier;
      this.completionNotifier = null;
      notify();
    }
  }

  /**
   * Handle task failure.
   */
  private handleTaskFailure(taskId: string, error: Error): void {
    const active = this.activeTasks.get(taskId);
    if (active) {
      clearTimeout(active.timeout);
      const failedTask: AgentTask = {
        ...active.task,
        status: TaskStatus.FAILED,
        error: error.message,
      };

      // Retry if within limits
      if (failedTask.retryCount < failedTask.maxRetries) {
        failedTask.retryCount++;
        failedTask.status = TaskStatus.PENDING;
        this.taskQueue.enqueue(failedTask);
      } else {
        this.taskResults.set(taskId, failedTask);
        this.taskQueue.markFailed(taskId);
      }

      if (failedTask.assignedAgent) {
        this.recordFailure(failedTask.assignedAgent);
      }
      this.activeTasks.delete(taskId);
    }

    // Notify any waiting executePlan loop
    if (this.completionNotifier) {
      const notify = this.completionNotifier;
      this.completionNotifier = null;
      notify();
    }
  }

  /**
   * Handle task timeout.
   */
  private handleTaskTimeout(taskId: string): void {
    const active = this.activeTasks.get(taskId);
    if (active) {
      const timedOutTask: AgentTask = {
        ...active.task,
        status: TaskStatus.FAILED,
        error: `Task timed out after ${this.config.taskTimeout}ms`,
      };
      this.activeTasks.delete(taskId);
      this.taskResults.set(taskId, timedOutTask);
      this.taskQueue.markFailed(taskId);

      // Notify any waiting executePlan loop
      if (this.completionNotifier) {
        const notify = this.completionNotifier;
        this.completionNotifier = null;
        notify();
      }
    }
  }

  /**
   * Wait for the next task to complete.
   * Uses an event-driven approach: resolves when a task completes or fails
   * rather than polling state in a tight loop.
   */
  private waitForNextCompletion(): Promise<void> {
    // If conditions are already met, resolve immediately
    if (this.activeTasks.size === 0 || this.taskQueue.getReady().length > 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.completionNotifier = resolve;
    });
  }

  /**
   * Execute a task with a timeout wrapper.
   */
  private executeWithTimeout(agent: BaseAgent, task: AgentTask): Promise<AgentTask> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task timed out after ${this.config.taskTimeout}ms`));
      }, this.config.taskTimeout);

      agent
        .execute(task)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Record a successful execution for the circuit breaker.
   */
  private recordSuccess(agentId: string): void {
    const state = this.circuitBreaker.get(agentId);
    if (state) {
      state.failures = 0;
      state.open = false;
    }
  }

  /**
   * Record a failure for the circuit breaker.
   */
  private recordFailure(agentId: string): void {
    const state = this.circuitBreaker.get(agentId) ?? { failures: 0, lastFailure: 0, open: false };
    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= this.config.circuitBreakerThreshold) {
      state.open = true;
    }
    this.circuitBreaker.set(agentId, state);
  }

  /**
   * Check if the circuit breaker is open for an agent.
   */
  private isCircuitOpen(agentId: string): boolean {
    const state = this.circuitBreaker.get(agentId);
    if (!state || !state.open) return false;

    // Check if enough time has passed to try again
    if (Date.now() - state.lastFailure > this.config.circuitBreakerResetTime) {
      state.open = false;
      state.failures = 0;
      return false;
    }
    return true;
  }
}
