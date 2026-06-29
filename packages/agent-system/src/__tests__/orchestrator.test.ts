import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { BaseAgent } from '../agent/base-agent.js';
import { AgentOrchestrator } from '../orchestrator.js';
import {
  type AgentTask,
  type ExecutionPlan,
  AgentRole,
  TaskStatus,
  TaskPriority,
} from '../types/index.js';

class MockAgent extends BaseAgent {
  executeDelay: number;
  shouldFail: boolean;

  constructor(id: string, role: AgentRole, taskTypes: string[], executeDelay = 0, shouldFail = false) {
    super({
      id,
      role,
      systemPrompt: 'test',
      capabilities: taskTypes.map((t) => ({ name: t, description: t })),
    });
    this.executeDelay = executeDelay;
    this.shouldFail = shouldFail;
    this._taskTypes = taskTypes;
  }

  private _taskTypes: string[];

  canHandle(taskType: string): boolean {
    return this._taskTypes.includes(taskType);
  }

  async execute(task: AgentTask): Promise<AgentTask> {
    if (this.executeDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.executeDelay));
    }

    if (this.shouldFail) {
      return {
        ...task,
        status: TaskStatus.FAILED,
        error: 'Mock agent failure',
      };
    }

    return {
      ...task,
      status: TaskStatus.COMPLETED,
      output: { result: `completed by ${this.id}` },
      completedAt: new Date(),
    };
  }
}

function createTask(overrides?: Partial<AgentTask>): AgentTask {
  return {
    id: crypto.randomUUID(),
    type: 'backend',
    description: 'Test task',
    input: {},
    status: TaskStatus.PENDING,
    dependencies: [],
    priority: TaskPriority.MEDIUM,
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    orchestrator = new AgentOrchestrator({
      maxConcurrentTasks: 3,
      taskTimeout: 5000,
      retryAttempts: 2,
    });
  });

  afterEach(() => {
    orchestrator.dispose();
  });

  describe('agent registration', () => {
    it('should register agents', () => {
      const agent = new MockAgent('agent-1', AgentRole.BACKEND, ['backend']);
      orchestrator.registerAgent(agent);

      expect(orchestrator.getAgents()).toHaveLength(1);
      expect(orchestrator.getAgentsByRole(AgentRole.BACKEND)).toHaveLength(1);
    });

    it('should unregister agents', () => {
      const agent = new MockAgent('agent-1', AgentRole.BACKEND, ['backend']);
      orchestrator.registerAgent(agent);
      orchestrator.unregisterAgent('agent-1');

      expect(orchestrator.getAgents()).toHaveLength(0);
    });
  });

  describe('task submission', () => {
    it('should execute a task and return results', async () => {
      const agent = new MockAgent('backend-agent', AgentRole.BACKEND, ['backend']);
      orchestrator.registerAgent(agent);

      const task = createTask();
      const result = await orchestrator.submitTask(task);

      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(result.output).toEqual({ result: 'completed by backend-agent' });
      expect(result.assignedAgent).toBe('backend-agent');
    });

    it('should fail when no agent can handle the task', async () => {
      const agent = new MockAgent('frontend-agent', AgentRole.FRONTEND, ['frontend']);
      orchestrator.registerAgent(agent);

      const task = createTask({ type: 'database' });
      const result = await orchestrator.submitTask(task);

      expect(result.status).toBe(TaskStatus.FAILED);
      expect(result.error).toContain('No agent found');
    });
  });

  describe('plan execution', () => {
    it('should execute tasks respecting dependency order', async () => {
      const executionOrder: string[] = [];

      class OrderTrackingAgent extends MockAgent {
        async execute(task: AgentTask): Promise<AgentTask> {
          executionOrder.push(task.id);
          return super.execute(task);
        }
      }

      const agent = new OrderTrackingAgent('backend-agent', AgentRole.BACKEND, ['backend', 'frontend']);
      orchestrator.registerAgent(agent);

      const task1 = createTask({ id: 'task-1', type: 'backend' });
      const task2 = createTask({ id: 'task-2', type: 'frontend', dependencies: ['task-1'] });

      const plan: ExecutionPlan = {
        id: 'plan-1',
        description: 'Test plan',
        tasks: [task1, task2],
        estimatedComplexity: 3,
        parallelizableGroups: [['task-1'], ['task-2']],
      };

      const result = await orchestrator.executePlan(plan);

      expect(result.success).toBe(true);
      expect(executionOrder.indexOf('task-1')).toBeLessThan(executionOrder.indexOf('task-2'));
    });

    it('should execute independent tasks in parallel', async () => {
      const startTimes: Map<string, number> = new Map();

      class TimingAgent extends MockAgent {
        async execute(task: AgentTask): Promise<AgentTask> {
          startTimes.set(task.id, Date.now());
          await new Promise((resolve) => setTimeout(resolve, 50));
          return super.execute(task);
        }
      }

      const agent1 = new TimingAgent('agent-1', AgentRole.BACKEND, ['backend']);
      const agent2 = new TimingAgent('agent-2', AgentRole.FRONTEND, ['frontend']);
      orchestrator.registerAgent(agent1);
      orchestrator.registerAgent(agent2);

      const task1 = createTask({ id: 'task-1', type: 'backend' });
      const task2 = createTask({ id: 'task-2', type: 'frontend' });

      const plan: ExecutionPlan = {
        id: 'plan-1',
        description: 'Parallel test',
        tasks: [task1, task2],
        estimatedComplexity: 3,
        parallelizableGroups: [['task-1', 'task-2']],
      };

      const result = await orchestrator.executePlan(plan);

      expect(result.success).toBe(true);
      // Both tasks should have started close to each other (within 30ms)
      const t1Start = startTimes.get('task-1')!;
      const t2Start = startTimes.get('task-2')!;
      expect(Math.abs(t1Start - t2Start)).toBeLessThan(30);
    });

    it('should handle task failures in plans', async () => {
      const agent = new MockAgent('agent-1', AgentRole.BACKEND, ['backend'], 0, true);
      orchestrator.registerAgent(agent);

      const task1 = createTask({ id: 'task-1', type: 'backend', maxRetries: 0 });

      const plan: ExecutionPlan = {
        id: 'plan-1',
        description: 'Failure test',
        tasks: [task1],
        estimatedComplexity: 3,
        parallelizableGroups: [['task-1']],
      };

      const result = await orchestrator.executePlan(plan);

      expect(result.success).toBe(false);
    });
  });

  describe('event bus access', () => {
    it('should provide access to the event bus', () => {
      const bus = orchestrator.getEventBus();
      expect(bus).toBeDefined();
    });
  });

  describe('conflict resolver access', () => {
    it('should provide access to the conflict resolver', () => {
      const resolver = orchestrator.getConflictResolver();
      expect(resolver).toBeDefined();
    });
  });
});
