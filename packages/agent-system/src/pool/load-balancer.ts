// ============================================================================
// LoadBalancer - Distributes tasks across agents using configurable strategies
// ============================================================================

import { type BaseAgent } from '../agent/base-agent.js';
import { AgentState, LoadBalancerStrategy } from '../types/index.js';

/**
 * LoadBalancer selects the most appropriate agent from a pool
 * based on the configured strategy and current agent states.
 */
export class LoadBalancer {
  private strategy: LoadBalancerStrategy;
  private roundRobinIndex: number = 0;

  constructor(strategy: LoadBalancerStrategy) {
    this.strategy = strategy;
  }

  /**
   * Select the best agent for a given task type based on the current strategy.
   */
  selectAgent(agents: BaseAgent[], taskType: string): BaseAgent | undefined {
    if (agents.length === 0) return undefined;

    switch (this.strategy) {
      case LoadBalancerStrategy.ROUND_ROBIN:
        return this.roundRobin(agents);
      case LoadBalancerStrategy.LEAST_LOADED:
        return this.leastLoaded(agents);
      case LoadBalancerStrategy.CAPABILITY_MATCH:
        return this.capabilityMatch(agents, taskType);
      default:
        return this.roundRobin(agents);
    }
  }

  /**
   * Get the current strategy.
   */
  getStrategy(): LoadBalancerStrategy {
    return this.strategy;
  }

  /**
   * Set a new strategy.
   */
  setStrategy(strategy: LoadBalancerStrategy): void {
    this.strategy = strategy;
    this.roundRobinIndex = 0;
  }

  /**
   * Round-robin: cycles through agents sequentially.
   */
  private roundRobin(agents: BaseAgent[]): BaseAgent | undefined {
    if (agents.length === 0) return undefined;
    const index = this.roundRobinIndex % agents.length;
    this.roundRobinIndex = (this.roundRobinIndex + 1) % agents.length;
    return agents[index];
  }

  /**
   * Least-loaded: prefers IDLE agents over WORKING ones.
   */
  private leastLoaded(agents: BaseAgent[]): BaseAgent | undefined {
    if (agents.length === 0) return undefined;

    // Sort agents by state priority: IDLE first, then WORKING, then others
    const sorted = [...agents].sort((a, b) => {
      const stateOrder = this.getStateOrder(a.getState()) - this.getStateOrder(b.getState());
      return stateOrder;
    });

    return sorted[0];
  }

  /**
   * Capability-match: scores agents by how many capabilities match the task type.
   */
  private capabilityMatch(agents: BaseAgent[], taskType: string): BaseAgent | undefined {
    if (agents.length === 0) return undefined;

    let bestAgent: BaseAgent | undefined;
    let bestScore = -1;

    for (const agent of agents) {
      const score = this.calculateCapabilityScore(agent, taskType);
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }

  /**
   * Calculate capability match score for an agent given a task type.
   */
  private calculateCapabilityScore(agent: BaseAgent, taskType: string): number {
    let score = 0;
    for (const capability of agent.capabilities) {
      if (capability.name === taskType || capability.name.includes(taskType) || taskType.includes(capability.name)) {
        score++;
      }
    }
    return score;
  }

  /**
   * Get numeric order for agent states (lower = more available).
   */
  private getStateOrder(state: AgentState): number {
    switch (state) {
      case AgentState.IDLE:
        return 0;
      case AgentState.WORKING:
        return 1;
      case AgentState.WAITING:
        return 2;
      case AgentState.BLOCKED:
        return 3;
      case AgentState.COMPLETED:
        return 4;
      case AgentState.FAILED:
        return 5;
      default:
        return 6;
    }
  }
}
