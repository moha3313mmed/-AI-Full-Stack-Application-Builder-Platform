import { type AIProvider, type AICompletionRequest, type AICompletionResponse, type AIStreamChunk } from '@builder/ai-core';
import { describe, it, expect, vi } from 'vitest';

import { TaskDecomposer } from '../task/task-decomposer.js';
import { TaskStatus, TaskPriority } from '../types/index.js';

function createMockProvider(response: string): AIProvider {
  return {
    name: 'mock-provider',
    complete: vi.fn().mockResolvedValue({
      content: response,
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      model: 'gpt-4',
      finishReason: 'stop',
    } as AICompletionResponse),
    stream: vi.fn() as unknown as (request: AICompletionRequest) => AsyncGenerator<AIStreamChunk>,
    countTokens: vi.fn().mockResolvedValue(100),
    listModels: vi.fn().mockResolvedValue(['gpt-4']),
  };
}

describe('TaskDecomposer', () => {
  it('should decompose a request into an execution plan', async () => {
    const aiResponse = JSON.stringify({
      description: 'Build a user authentication system',
      tasks: [
        {
          type: 'schema_design',
          description: 'Design user database schema',
          role: 'DATABASE',
          dependencies: [],
          priority: 'HIGH',
          complexity: 3,
        },
        {
          type: 'api_implementation',
          description: 'Implement auth API endpoints',
          role: 'BACKEND',
          dependencies: [0],
          priority: 'HIGH',
          complexity: 5,
        },
        {
          type: 'component_creation',
          description: 'Build login/signup forms',
          role: 'FRONTEND',
          dependencies: [1],
          priority: 'MEDIUM',
          complexity: 4,
        },
        {
          type: 'vulnerability_analysis',
          description: 'Security review of auth flow',
          role: 'SECURITY',
          dependencies: [1],
          priority: 'HIGH',
          complexity: 4,
        },
      ],
      estimatedComplexity: 7,
    });

    const provider = createMockProvider(aiResponse);
    const decomposer = new TaskDecomposer({ provider });

    const plan = await decomposer.decompose('Build a user authentication system');

    expect(plan.description).toBe('Build a user authentication system');
    expect(plan.tasks).toHaveLength(4);
    expect(plan.estimatedComplexity).toBe(7);

    // First task has no dependencies
    expect(plan.tasks[0].dependencies).toHaveLength(0);
    expect(plan.tasks[0].type).toBe('schema_design');
    expect(plan.tasks[0].priority).toBe(TaskPriority.HIGH);
    expect(plan.tasks[0].status).toBe(TaskStatus.PENDING);

    // Second task depends on first
    expect(plan.tasks[1].dependencies).toContain(plan.tasks[0].id);

    // Third and fourth tasks depend on second
    expect(plan.tasks[2].dependencies).toContain(plan.tasks[1].id);
    expect(plan.tasks[3].dependencies).toContain(plan.tasks[1].id);

    // Verify the provider was called
    expect(provider.complete).toHaveBeenCalledTimes(1);
  });

  it('should identify parallelizable groups', async () => {
    const aiResponse = JSON.stringify({
      description: 'Build frontend and backend',
      tasks: [
        {
          type: 'system_design',
          description: 'Architecture design',
          role: 'ARCHITECT',
          dependencies: [],
          priority: 'HIGH',
          complexity: 3,
        },
        {
          type: 'component_creation',
          description: 'Build UI',
          role: 'FRONTEND',
          dependencies: [0],
          priority: 'MEDIUM',
          complexity: 4,
        },
        {
          type: 'api_implementation',
          description: 'Build API',
          role: 'BACKEND',
          dependencies: [0],
          priority: 'MEDIUM',
          complexity: 4,
        },
      ],
      estimatedComplexity: 5,
    });

    const provider = createMockProvider(aiResponse);
    const decomposer = new TaskDecomposer({ provider });

    const plan = await decomposer.decompose('Build frontend and backend');

    // Group 1: architecture (no deps)
    // Group 2: frontend + backend (both depend only on architecture)
    expect(plan.parallelizableGroups.length).toBe(2);
    expect(plan.parallelizableGroups[0]).toHaveLength(1); // architecture
    expect(plan.parallelizableGroups[1]).toHaveLength(2); // frontend + backend in parallel
  });

  it('should handle malformed AI responses gracefully', async () => {
    const provider = createMockProvider('This is not valid JSON');
    const decomposer = new TaskDecomposer({ provider });

    const plan = await decomposer.decompose('Do something');

    // Should fallback to single task
    expect(plan.tasks).toHaveLength(1);
    expect(plan.description).toBe('Single task execution');
  });

  it('should include context in the request when provided', async () => {
    const aiResponse = JSON.stringify({
      description: 'Task with context',
      tasks: [
        {
          type: 'general',
          description: 'Do the thing',
          role: 'BACKEND',
          dependencies: [],
          priority: 'MEDIUM',
          complexity: 3,
        },
      ],
      estimatedComplexity: 3,
    });

    const provider = createMockProvider(aiResponse);
    const decomposer = new TaskDecomposer({ provider });

    await decomposer.decompose('Build feature X', { framework: 'next.js', database: 'postgres' });

    const callArgs = (provider.complete as ReturnType<typeof vi.fn>).mock.calls[0][0] as AICompletionRequest;
    expect(callArgs.messages[1].content).toContain('next.js');
    expect(callArgs.messages[1].content).toContain('postgres');
  });
});
