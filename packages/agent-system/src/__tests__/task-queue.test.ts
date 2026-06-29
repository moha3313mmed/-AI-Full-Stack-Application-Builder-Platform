import { describe, it, expect, beforeEach } from 'vitest';

import { TaskQueue } from '../task/task-queue.js';
import { type AgentTask, TaskStatus, TaskPriority } from '../types/index.js';

describe('TaskQueue', () => {
  let queue: TaskQueue;

  beforeEach(() => {
    queue = new TaskQueue();
  });

  function createTask(overrides?: Partial<AgentTask>): AgentTask {
    return {
      id: crypto.randomUUID(),
      type: 'test_task',
      description: 'A test task',
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

  describe('enqueue/dequeue', () => {
    it('should enqueue and dequeue tasks', () => {
      const task = createTask();
      queue.enqueue(task);

      expect(queue.size).toBe(1);
      expect(queue.isEmpty).toBe(false);

      const dequeued = queue.dequeue();
      expect(dequeued).toEqual(task);
      expect(queue.size).toBe(0);
      expect(queue.isEmpty).toBe(true);
    });

    it('should return undefined when dequeuing from empty queue', () => {
      expect(queue.dequeue()).toBeUndefined();
    });
  });

  describe('priority ordering', () => {
    it('should dequeue higher priority tasks first', () => {
      const lowPriority = createTask({ id: 'low', priority: TaskPriority.LOW });
      const highPriority = createTask({ id: 'high', priority: TaskPriority.HIGH });
      const criticalPriority = createTask({ id: 'critical', priority: TaskPriority.CRITICAL });
      const mediumPriority = createTask({ id: 'medium', priority: TaskPriority.MEDIUM });

      queue.enqueue(lowPriority);
      queue.enqueue(highPriority);
      queue.enqueue(criticalPriority);
      queue.enqueue(mediumPriority);

      expect(queue.dequeue()!.id).toBe('critical');
      expect(queue.dequeue()!.id).toBe('high');
      expect(queue.dequeue()!.id).toBe('medium');
      expect(queue.dequeue()!.id).toBe('low');
    });

    it('should re-order when priority is updated', () => {
      const task1 = createTask({ id: 'task1', priority: TaskPriority.LOW });
      const task2 = createTask({ id: 'task2', priority: TaskPriority.MEDIUM });

      queue.enqueue(task1);
      queue.enqueue(task2);

      queue.prioritize('task1', TaskPriority.CRITICAL);

      expect(queue.dequeue()!.id).toBe('task1');
    });
  });

  describe('dependency resolution', () => {
    it('should not dequeue tasks with unresolved dependencies', () => {
      const task1 = createTask({ id: 'task1' });
      const task2 = createTask({ id: 'task2', dependencies: ['task1'] });

      queue.enqueue(task2);
      queue.enqueue(task1);

      // task1 should be dequeued first (no deps)
      const first = queue.dequeue();
      expect(first!.id).toBe('task1');

      // task2 should not be dequeued yet (task1 not marked complete)
      const second = queue.dequeue();
      expect(second).toBeUndefined();

      // Mark task1 as complete
      queue.markCompleted('task1');

      // Now task2 should be available
      const third = queue.dequeue();
      expect(third!.id).toBe('task2');
    });

    it('should handle multiple dependencies', () => {
      const task1 = createTask({ id: 'task1', priority: TaskPriority.HIGH });
      const task2 = createTask({ id: 'task2', priority: TaskPriority.HIGH });
      const task3 = createTask({ id: 'task3', dependencies: ['task1', 'task2'] });

      queue.enqueue(task3);
      queue.enqueue(task1);
      queue.enqueue(task2);

      queue.dequeue(); // task1
      queue.markCompleted('task1');

      // task3 still blocked by task2
      expect(queue.peek()!.id).toBe('task2');

      queue.dequeue(); // task2
      queue.markCompleted('task2');

      // Now task3 is ready
      expect(queue.dequeue()!.id).toBe('task3');
    });
  });

  describe('deadlock detection', () => {
    it('should detect deadlock when no tasks are ready', () => {
      // Circular dependency scenario
      const task1 = createTask({ id: 'task1', dependencies: ['task2'] });
      const task2 = createTask({ id: 'task2', dependencies: ['task1'] });

      queue.enqueue(task1);
      queue.enqueue(task2);

      expect(queue.detectDeadlock()).toBe(true);
    });

    it('should not detect deadlock when tasks are ready', () => {
      const task = createTask({ id: 'task1' });
      queue.enqueue(task);

      expect(queue.detectDeadlock()).toBe(false);
    });

    it('should not detect deadlock on empty queue', () => {
      expect(queue.detectDeadlock()).toBe(false);
    });
  });

  describe('markFailed', () => {
    it('should block dependent tasks when a task fails', () => {
      const task1 = createTask({ id: 'task1' });
      const task2 = createTask({ id: 'task2', dependencies: ['task1'] });

      queue.enqueue(task1);
      queue.enqueue(task2);

      queue.dequeue(); // task1
      queue.markFailed('task1');

      // task2 should be blocked
      const next = queue.dequeue();
      expect(next).toBeUndefined();
    });
  });

  describe('enqueueBatch', () => {
    it('should add multiple tasks at once', () => {
      const tasks = [
        createTask({ id: 'task1', priority: TaskPriority.LOW }),
        createTask({ id: 'task2', priority: TaskPriority.HIGH }),
        createTask({ id: 'task3', priority: TaskPriority.MEDIUM }),
      ];

      queue.enqueueBatch(tasks);
      expect(queue.size).toBe(3);
      expect(queue.dequeue()!.id).toBe('task2');
    });
  });

  describe('getReady', () => {
    it('should return all ready tasks', () => {
      const task1 = createTask({ id: 'task1' });
      const task2 = createTask({ id: 'task2' });
      const task3 = createTask({ id: 'task3', dependencies: ['task1'] });

      queue.enqueue(task1);
      queue.enqueue(task2);
      queue.enqueue(task3);

      const ready = queue.getReady();
      expect(ready.length).toBe(2);
      expect(ready.map((t) => t.id).sort()).toEqual(['task1', 'task2']);
    });
  });

  describe('remove', () => {
    it('should remove a task from the queue', () => {
      const task = createTask({ id: 'task1' });
      queue.enqueue(task);

      expect(queue.remove('task1')).toBe(true);
      expect(queue.size).toBe(0);
    });

    it('should return false for non-existent task', () => {
      expect(queue.remove('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all tasks', () => {
      queue.enqueue(createTask());
      queue.enqueue(createTask());
      queue.clear();

      expect(queue.size).toBe(0);
      expect(queue.isEmpty).toBe(true);
    });
  });
});
