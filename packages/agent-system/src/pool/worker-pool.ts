// ============================================================================
// WorkerPool - Manages a pool of agent workers with dynamic scaling
// ============================================================================

import { type BaseAgent } from '../agent/base-agent.js';
import { AgentState, type WorkerPoolConfig, type PoolStats } from '../types/index.js';

import { LoadBalancer } from './load-balancer.js';

/**
 * WorkerPool manages a pool of BaseAgent workers, supporting
 * dynamic scaling and task distribution via a LoadBalancer.
 */
export class WorkerPool {
  private workers: Map<string, BaseAgent> = new Map();
  private config: WorkerPoolConfig;
  private loadBalancer: LoadBalancer;
  private queuedTasks: number = 0;
  private totalTaskDuration: number = 0;
  private completedTaskCount: number = 0;

  constructor(config: WorkerPoolConfig) {
    this.config = config;
    this.loadBalancer = new LoadBalancer(config.strategy);
  }

  /**
   * Add a worker agent to the pool.
   */
  addWorker(agent: BaseAgent): void {
    if (this.workers.size >= this.config.maxWorkers) {
      throw new Error(
        `Cannot add worker: pool at maximum capacity (${this.config.maxWorkers})`,
      );
    }
    this.workers.set(agent.id, agent);
  }

  /**
   * Remove a worker agent from the pool by ID.
   */
  removeWorker(agentId: string): void {
    if (this.workers.size <= this.config.minWorkers) {
      throw new Error(
        `Cannot remove worker: pool at minimum capacity (${this.config.minWorkers})`,
      );
    }
    this.workers.delete(agentId);
  }

  /**
   * Get an available worker for the given task type using the configured strategy.
   */
  getAvailableWorker(taskType: string): BaseAgent | undefined {
    const agents = Array.from(this.workers.values());
    const capableAgents = agents.filter((agent) => agent.canHandle(taskType));
    if (capableAgents.length === 0) return undefined;
    return this.loadBalancer.selectAgent(capableAgents, taskType);
  }

  /**
   * Get all workers in the pool.
   */
  getWorkers(): BaseAgent[] {
    return Array.from(this.workers.values());
  }

  /**
   * Get current pool statistics.
   */
  getPoolStats(): PoolStats {
    const agents = Array.from(this.workers.values());
    const activeWorkers = agents.filter(
      (agent) => agent.getState() === AgentState.WORKING,
    ).length;
    const idleWorkers = agents.filter(
      (agent) => agent.getState() === AgentState.IDLE,
    ).length;

    return {
      totalWorkers: this.workers.size,
      activeWorkers,
      idleWorkers,
      queuedTasks: this.queuedTasks,
      avgTaskDuration:
        this.completedTaskCount > 0
          ? this.totalTaskDuration / this.completedTaskCount
          : 0,
    };
  }

  /**
   * Scale the pool to the target number of workers.
   * Returns the number of workers that need to be added (positive) or removed (negative).
   */
  scale(targetCount: number): number {
    const clamped = Math.max(
      this.config.minWorkers,
      Math.min(this.config.maxWorkers, targetCount),
    );
    const delta = clamped - this.workers.size;
    return delta;
  }

  /**
   * Get the pool configuration.
   */
  getConfig(): WorkerPoolConfig {
    return { ...this.config };
  }

  /**
   * Get the load balancer instance.
   */
  getLoadBalancer(): LoadBalancer {
    return this.loadBalancer;
  }

  /**
   * Update the queued tasks count.
   */
  setQueuedTasks(count: number): void {
    this.queuedTasks = count;
  }

  /**
   * Record a completed task duration for stats.
   */
  recordTaskCompletion(durationMs: number): void {
    this.totalTaskDuration += durationMs;
    this.completedTaskCount++;
  }

  /**
   * Check if the pool should scale up based on current utilization.
   */
  shouldScaleUp(): boolean {
    const stats = this.getPoolStats();
    if (stats.totalWorkers === 0) return true;
    const utilization = stats.activeWorkers / stats.totalWorkers;
    return utilization >= this.config.scaleUpThreshold;
  }

  /**
   * Check if the pool should scale down based on current utilization.
   */
  shouldScaleDown(): boolean {
    const stats = this.getPoolStats();
    if (stats.totalWorkers <= this.config.minWorkers) return false;
    const utilization = stats.activeWorkers / stats.totalWorkers;
    return utilization <= this.config.scaleDownThreshold;
  }
}
