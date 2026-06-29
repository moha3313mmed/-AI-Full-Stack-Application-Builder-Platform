// ============================================================================
// TaskQueue - Priority queue with dependency resolution
// ============================================================================

import { type AgentTask, TaskStatus, TaskPriority } from '../types/index.js';

/**
 * Priority task queue that orders tasks by priority and respects dependencies.
 * Supports enqueue, dequeue, peek, prioritize, and deadlock detection.
 */
export class TaskQueue {
  private tasks: AgentTask[] = [];
  private completedTaskIds: Set<string> = new Set();
  private inProgressTaskIds: Set<string> = new Set();

  /**
   * Add a task to the queue.
   */
  enqueue(task: AgentTask): void {
    this.tasks.push(task);
    this.sortQueue();
  }

  /**
   * Add multiple tasks to the queue.
   */
  enqueueBatch(tasks: AgentTask[]): void {
    this.tasks.push(...tasks);
    this.sortQueue();
  }

  /**
   * Get and remove the next ready task (all dependencies resolved).
   */
  dequeue(): AgentTask | undefined {
    const index = this.tasks.findIndex((task) => this.isReady(task));
    if (index === -1) return undefined;

    const [task] = this.tasks.splice(index, 1);
    this.inProgressTaskIds.add(task.id);
    return task;
  }

  /**
   * Peek at the next ready task without removing it.
   */
  peek(): AgentTask | undefined {
    return this.tasks.find((task) => this.isReady(task));
  }

  /**
   * Get all tasks that are currently ready to execute.
   */
  getReady(): AgentTask[] {
    return this.tasks.filter((task) => this.isReady(task));
  }

  /**
   * Update the priority of a task.
   */
  prioritize(taskId: string, priority: TaskPriority): boolean {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return false;
    task.priority = priority;
    this.sortQueue();
    return true;
  }

  /**
   * Mark a task as completed (unblocks dependent tasks).
   */
  markCompleted(taskId: string): void {
    this.completedTaskIds.add(taskId);
    this.inProgressTaskIds.delete(taskId);
  }

  /**
   * Mark a task as failed.
   */
  markFailed(taskId: string): void {
    this.inProgressTaskIds.delete(taskId);
    // Remove tasks that depend on the failed task
    this.tasks = this.tasks.map((task) => {
      if (task.dependencies.includes(taskId)) {
        return { ...task, status: TaskStatus.BLOCKED };
      }
      return task;
    });
  }

  /**
   * Detect if there's a deadlock (circular dependency).
   */
  detectDeadlock(): boolean {
    // If no tasks are ready and queue is non-empty, and nothing is in progress
    if (this.tasks.length > 0 && this.inProgressTaskIds.size === 0) {
      const readyCount = this.tasks.filter((t) => this.isReady(t)).length;
      return readyCount === 0;
    }
    return false;
  }

  /**
   * Get the current size of the queue.
   */
  get size(): number {
    return this.tasks.length;
  }

  /**
   * Check if the queue is empty.
   */
  get isEmpty(): boolean {
    return this.tasks.length === 0;
  }

  /**
   * Get all tasks currently in the queue (for inspection).
   */
  getAll(): AgentTask[] {
    return [...this.tasks];
  }

  /**
   * Remove a task from the queue.
   */
  remove(taskId: string): boolean {
    const index = this.tasks.findIndex((t) => t.id === taskId);
    if (index === -1) return false;
    this.tasks.splice(index, 1);
    return true;
  }

  /**
   * Clear all tasks from the queue.
   */
  clear(): void {
    this.tasks = [];
    this.completedTaskIds.clear();
    this.inProgressTaskIds.clear();
  }

  /**
   * Check if a task is ready to execute (all dependencies resolved).
   */
  private isReady(task: AgentTask): boolean {
    if (task.status === TaskStatus.BLOCKED || task.status === TaskStatus.CANCELLED) {
      return false;
    }
    return task.dependencies.every((dep) => this.completedTaskIds.has(dep));
  }

  /**
   * Sort the queue by priority (lower number = higher priority).
   */
  private sortQueue(): void {
    this.tasks.sort((a, b) => a.priority - b.priority);
  }
}
