import { describe, it, expect, beforeEach } from 'vitest';

import { BaseAgent } from '../agent/base-agent.js';
import { WorkerPool } from '../pool/worker-pool.js';
import {
  type AgentTask,
  AgentRole,
  AgentState,
  TaskStatus,
  LoadBalancerStrategy,
} from '../types/index.js';

class MockPoolAgent extends BaseAgent {
  private _taskTypes: string[];
  private _forcedState: AgentState | null = null;

  constructor(id: string, role: AgentRole, taskTypes: string[]) {
    super({
      id,
      role,
      systemPrompt: 'test',
      capabilities: taskTypes.map((t) => ({ name: t, description: t })),
    });
    this._taskTypes = taskTypes;
  }

  canHandle(taskType: string): boolean {
    return this._taskTypes.includes(taskType);
  }

  async execute(task: AgentTask): Promise<AgentTask> {
    return {
      ...task,
      status: TaskStatus.COMPLETED,
      output: { result: `completed by ${this.id}` },
      completedAt: new Date(),
    };
  }

  forceState(state: AgentState): void {
    this._forcedState = state;
  }

  getState(): AgentState {
    return this._forcedState ?? super.getState();
  }
}

describe('WorkerPool', () => {
  let pool: WorkerPool;

  beforeEach(() => {
    pool = new WorkerPool({
      minWorkers: 1,
      maxWorkers: 5,
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.2,
      strategy: LoadBalancerStrategy.ROUND_ROBIN,
    });
  });

  describe('adding and removing workers', () => {
    it('should add workers to the pool', () => {
      const agent = new MockPoolAgent('agent-1', AgentRole.BACKEND, ['backend']);
      pool.addWorker(agent);

      expect(pool.getWorkers()).toHaveLength(1);
      expect(pool.getWorkers()[0].id).toBe('agent-1');
    });

    it('should add multiple workers', () => {
      const agent1 = new MockPoolAgent('agent-1', AgentRole.BACKEND, ['backend']);
      const agent2 = new MockPoolAgent('agent-2', AgentRole.FRONTEND, ['frontend']);
      pool.addWorker(agent1);
      pool.addWorker(agent2);

      expect(pool.getWorkers()).toHaveLength(2);
    });

    it('should throw when adding beyond max capacity', () => {
      for (let i = 0; i < 5; i++) {
        pool.addWorker(new MockPoolAgent(`agent-${i}`, AgentRole.BACKEND, ['backend']));
      }

      expect(() => {
        pool.addWorker(new MockPoolAgent('agent-overflow', AgentRole.BACKEND, ['backend']));
      }).toThrow('Cannot add worker: pool at maximum capacity');
    });

    it('should remove a worker by ID', () => {
      const agent1 = new MockPoolAgent('agent-1', AgentRole.BACKEND, ['backend']);
      const agent2 = new MockPoolAgent('agent-2', AgentRole.FRONTEND, ['frontend']);
      pool.addWorker(agent1);
      pool.addWorker(agent2);
      pool.removeWorker('agent-1');

      expect(pool.getWorkers()).toHaveLength(1);
      expect(pool.getWorkers()[0].id).toBe('agent-2');
    });

    it('should throw when removing below min capacity', () => {
      const agent = new MockPoolAgent('agent-1', AgentRole.BACKEND, ['backend']);
      pool.addWorker(agent);

      expect(() => {
        pool.removeWorker('agent-1');
      }).toThrow('Cannot remove worker: pool at minimum capacity');
    });
  });

  describe('getAvailableWorker', () => {
    it('should return a worker that can handle the task type', () => {
      const backendAgent = new MockPoolAgent('backend-1', AgentRole.BACKEND, ['backend']);
      const frontendAgent = new MockPoolAgent('frontend-1', AgentRole.FRONTEND, ['frontend']);
      pool.addWorker(backendAgent);
      pool.addWorker(frontendAgent);

      const worker = pool.getAvailableWorker('backend');
      expect(worker).toBeDefined();
      expect(worker!.id).toBe('backend-1');
    });

    it('should return undefined when no worker can handle the task', () => {
      const agent = new MockPoolAgent('agent-1', AgentRole.BACKEND, ['backend']);
      pool.addWorker(agent);

      const worker = pool.getAvailableWorker('database');
      expect(worker).toBeUndefined();
    });

    it('should cycle through workers with round-robin strategy', () => {
      const agent1 = new MockPoolAgent('agent-1', AgentRole.BACKEND, ['backend']);
      const agent2 = new MockPoolAgent('agent-2', AgentRole.BACKEND, ['backend']);
      pool.addWorker(agent1);
      pool.addWorker(agent2);

      const first = pool.getAvailableWorker('backend');
      const second = pool.getAvailableWorker('backend');
      expect(first!.id).not.toBe(second!.id);
    });
  });

  describe('getPoolStats', () => {
    it('should return correct stats for empty pool', () => {
      const emptyPool = new WorkerPool({
        minWorkers: 0,
        maxWorkers: 5,
        scaleUpThreshold: 0.8,
        scaleDownThreshold: 0.2,
        strategy: LoadBalancerStrategy.ROUND_ROBIN,
      });

      const stats = emptyPool.getPoolStats();
      expect(stats.totalWorkers).toBe(0);
      expect(stats.activeWorkers).toBe(0);
      expect(stats.idleWorkers).toBe(0);
      expect(stats.queuedTasks).toBe(0);
      expect(stats.avgTaskDuration).toBe(0);
    });

    it('should count active and idle workers correctly', () => {
      const idleAgent = new MockPoolAgent('idle-1', AgentRole.BACKEND, ['backend']);
      const workingAgent = new MockPoolAgent('working-1', AgentRole.FRONTEND, ['frontend']);
      workingAgent.forceState(AgentState.WORKING);

      pool.addWorker(idleAgent);
      pool.addWorker(workingAgent);

      const stats = pool.getPoolStats();
      expect(stats.totalWorkers).toBe(2);
      expect(stats.activeWorkers).toBe(1);
      expect(stats.idleWorkers).toBe(1);
    });

    it('should track queued tasks', () => {
      pool.setQueuedTasks(5);
      const stats = pool.getPoolStats();
      expect(stats.queuedTasks).toBe(5);
    });

    it('should calculate average task duration', () => {
      pool.recordTaskCompletion(100);
      pool.recordTaskCompletion(200);
      pool.recordTaskCompletion(300);

      const stats = pool.getPoolStats();
      expect(stats.avgTaskDuration).toBe(200);
    });
  });

  describe('scaling', () => {
    it('should return positive delta when scaling up', () => {
      const agent = new MockPoolAgent('agent-1', AgentRole.BACKEND, ['backend']);
      pool.addWorker(agent);

      const delta = pool.scale(3);
      expect(delta).toBe(2);
    });

    it('should return negative delta when scaling down', () => {
      for (let i = 0; i < 4; i++) {
        pool.addWorker(new MockPoolAgent(`agent-${i}`, AgentRole.BACKEND, ['backend']));
      }

      const delta = pool.scale(2);
      expect(delta).toBe(-2);
    });

    it('should clamp to min workers', () => {
      const agent = new MockPoolAgent('agent-1', AgentRole.BACKEND, ['backend']);
      pool.addWorker(agent);

      const delta = pool.scale(0);
      expect(delta).toBe(0); // already at 1 which is minWorkers
    });

    it('should clamp to max workers', () => {
      const agent = new MockPoolAgent('agent-1', AgentRole.BACKEND, ['backend']);
      pool.addWorker(agent);

      const delta = pool.scale(100);
      expect(delta).toBe(4); // maxWorkers(5) - current(1) = 4
    });

    it('should detect when scale up is needed', () => {
      const workingAgent = new MockPoolAgent('working-1', AgentRole.BACKEND, ['backend']);
      workingAgent.forceState(AgentState.WORKING);
      pool.addWorker(workingAgent);

      expect(pool.shouldScaleUp()).toBe(true);
    });

    it('should detect when scale down is possible', () => {
      for (let i = 0; i < 5; i++) {
        pool.addWorker(new MockPoolAgent(`agent-${i}`, AgentRole.BACKEND, ['backend']));
      }
      // All idle, so utilization is 0 which is below scaleDownThreshold (0.2)
      expect(pool.shouldScaleDown()).toBe(true);
    });
  });
});
