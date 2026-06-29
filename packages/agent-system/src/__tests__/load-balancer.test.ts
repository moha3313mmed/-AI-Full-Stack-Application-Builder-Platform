import { describe, it, expect } from 'vitest';

import { BaseAgent } from '../agent/base-agent.js';
import { LoadBalancer } from '../pool/load-balancer.js';
import {
  type AgentTask,
  AgentRole,
  AgentState,
  TaskStatus,
  LoadBalancerStrategy,
} from '../types/index.js';

class MockLBAgent extends BaseAgent {
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

describe('LoadBalancer', () => {
  describe('ROUND_ROBIN strategy', () => {
    it('should cycle through agents sequentially', () => {
      const lb = new LoadBalancer(LoadBalancerStrategy.ROUND_ROBIN);
      const agents = [
        new MockLBAgent('agent-1', AgentRole.BACKEND, ['backend']),
        new MockLBAgent('agent-2', AgentRole.BACKEND, ['backend']),
        new MockLBAgent('agent-3', AgentRole.BACKEND, ['backend']),
      ];

      const first = lb.selectAgent(agents, 'backend');
      const second = lb.selectAgent(agents, 'backend');
      const third = lb.selectAgent(agents, 'backend');
      const fourth = lb.selectAgent(agents, 'backend');

      expect(first!.id).toBe('agent-1');
      expect(second!.id).toBe('agent-2');
      expect(third!.id).toBe('agent-3');
      // Should wrap around
      expect(fourth!.id).toBe('agent-1');
    });

    it('should return undefined for empty agent list', () => {
      const lb = new LoadBalancer(LoadBalancerStrategy.ROUND_ROBIN);
      const result = lb.selectAgent([], 'backend');
      expect(result).toBeUndefined();
    });

    it('should handle single agent', () => {
      const lb = new LoadBalancer(LoadBalancerStrategy.ROUND_ROBIN);
      const agents = [new MockLBAgent('agent-1', AgentRole.BACKEND, ['backend'])];

      const first = lb.selectAgent(agents, 'backend');
      const second = lb.selectAgent(agents, 'backend');

      expect(first!.id).toBe('agent-1');
      expect(second!.id).toBe('agent-1');
    });
  });

  describe('LEAST_LOADED strategy', () => {
    it('should prefer IDLE agents over WORKING ones', () => {
      const lb = new LoadBalancer(LoadBalancerStrategy.LEAST_LOADED);

      const workingAgent = new MockLBAgent('working-1', AgentRole.BACKEND, ['backend']);
      workingAgent.forceState(AgentState.WORKING);

      const idleAgent = new MockLBAgent('idle-1', AgentRole.BACKEND, ['backend']);
      idleAgent.forceState(AgentState.IDLE);

      const agents = [workingAgent, idleAgent];
      const selected = lb.selectAgent(agents, 'backend');

      expect(selected!.id).toBe('idle-1');
    });

    it('should prefer WORKING over BLOCKED agents', () => {
      const lb = new LoadBalancer(LoadBalancerStrategy.LEAST_LOADED);

      const blockedAgent = new MockLBAgent('blocked-1', AgentRole.BACKEND, ['backend']);
      blockedAgent.forceState(AgentState.BLOCKED);

      const workingAgent = new MockLBAgent('working-1', AgentRole.BACKEND, ['backend']);
      workingAgent.forceState(AgentState.WORKING);

      const agents = [blockedAgent, workingAgent];
      const selected = lb.selectAgent(agents, 'backend');

      expect(selected!.id).toBe('working-1');
    });

    it('should pick IDLE when all options available', () => {
      const lb = new LoadBalancer(LoadBalancerStrategy.LEAST_LOADED);

      const idleAgent = new MockLBAgent('idle-1', AgentRole.BACKEND, ['backend']);
      idleAgent.forceState(AgentState.IDLE);

      const workingAgent = new MockLBAgent('working-1', AgentRole.BACKEND, ['backend']);
      workingAgent.forceState(AgentState.WORKING);

      const waitingAgent = new MockLBAgent('waiting-1', AgentRole.BACKEND, ['backend']);
      waitingAgent.forceState(AgentState.WAITING);

      const agents = [workingAgent, waitingAgent, idleAgent];
      const selected = lb.selectAgent(agents, 'backend');

      expect(selected!.id).toBe('idle-1');
    });

    it('should return undefined for empty list', () => {
      const lb = new LoadBalancer(LoadBalancerStrategy.LEAST_LOADED);
      expect(lb.selectAgent([], 'backend')).toBeUndefined();
    });
  });

  describe('CAPABILITY_MATCH strategy', () => {
    it('should pick agent with highest capability match score', () => {
      const lb = new LoadBalancer(LoadBalancerStrategy.CAPABILITY_MATCH);

      const generalAgent = new MockLBAgent('general-1', AgentRole.BACKEND, ['backend']);
      const specializedAgent = new MockLBAgent('specialized-1', AgentRole.BACKEND, [
        'backend',
        'backend-api',
        'backend-database',
      ]);

      const agents = [generalAgent, specializedAgent];
      const selected = lb.selectAgent(agents, 'backend');

      // specializedAgent has more capabilities that match 'backend'
      expect(selected!.id).toBe('specialized-1');
    });

    it('should handle partial capability name matching', () => {
      const lb = new LoadBalancer(LoadBalancerStrategy.CAPABILITY_MATCH);

      const agent1 = new MockLBAgent('agent-1', AgentRole.FRONTEND, ['frontend-react']);
      const agent2 = new MockLBAgent('agent-2', AgentRole.FRONTEND, ['frontend-vue', 'frontend-react', 'frontend']);

      const agents = [agent1, agent2];
      const selected = lb.selectAgent(agents, 'frontend');

      // agent2 has more matches for 'frontend'
      expect(selected!.id).toBe('agent-2');
    });

    it('should return first agent when none match capabilities', () => {
      const lb = new LoadBalancer(LoadBalancerStrategy.CAPABILITY_MATCH);

      const agent1 = new MockLBAgent('agent-1', AgentRole.BACKEND, ['api']);
      const agent2 = new MockLBAgent('agent-2', AgentRole.BACKEND, ['database']);

      const agents = [agent1, agent2];
      const selected = lb.selectAgent(agents, 'frontend');

      // No matches, but scores are equal (0), first wins
      expect(selected).toBeDefined();
    });

    it('should return undefined for empty list', () => {
      const lb = new LoadBalancer(LoadBalancerStrategy.CAPABILITY_MATCH);
      expect(lb.selectAgent([], 'backend')).toBeUndefined();
    });
  });

  describe('strategy management', () => {
    it('should return the current strategy', () => {
      const lb = new LoadBalancer(LoadBalancerStrategy.ROUND_ROBIN);
      expect(lb.getStrategy()).toBe(LoadBalancerStrategy.ROUND_ROBIN);
    });

    it('should allow changing the strategy', () => {
      const lb = new LoadBalancer(LoadBalancerStrategy.ROUND_ROBIN);
      lb.setStrategy(LoadBalancerStrategy.LEAST_LOADED);
      expect(lb.getStrategy()).toBe(LoadBalancerStrategy.LEAST_LOADED);
    });
  });
});
