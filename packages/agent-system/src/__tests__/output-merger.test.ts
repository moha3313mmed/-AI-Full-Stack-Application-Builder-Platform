import { describe, it, expect, beforeEach } from 'vitest';

import { OutputMerger } from '../conflict/output-merger.js';
import type { AgentFileOutput } from '../conflict/output-merger.js';

describe('OutputMerger', () => {
  let merger: OutputMerger;

  beforeEach(() => {
    merger = new OutputMerger({ strategy: 'last-writer-wins' });
  });

  describe('merge', () => {
    it('should return empty result for no outputs', () => {
      const result = merger.merge([]);

      expect(result.operations).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
      expect(result.explanation).toBe('');
      expect(result.clean).toBe(true);
    });

    it('should pass through single agent output unchanged', () => {
      const output: AgentFileOutput = {
        agentId: 'frontend-agent',
        taskId: 'task-1',
        operations: [
          { type: 'create', path: '/src/App.tsx', content: 'app content', language: 'typescriptreact' },
          { type: 'create', path: '/src/index.ts', content: 'index content', language: 'typescript' },
        ],
        explanation: 'Created App component',
      };

      const result = merger.merge([output]);

      expect(result.operations).toHaveLength(2);
      expect(result.conflicts).toHaveLength(0);
      expect(result.explanation).toBe('Created App component');
      expect(result.clean).toBe(true);
    });

    it('should merge non-conflicting outputs from multiple agents', () => {
      const frontendOutput: AgentFileOutput = {
        agentId: 'frontend-agent',
        taskId: 'task-1',
        operations: [
          { type: 'create', path: '/src/components/Button.tsx', content: 'button', language: 'typescriptreact' },
        ],
        explanation: 'Created Button component',
      };

      const backendOutput: AgentFileOutput = {
        agentId: 'backend-agent',
        taskId: 'task-2',
        operations: [
          { type: 'create', path: '/src/api/users.ts', content: 'users api', language: 'typescript' },
        ],
        explanation: 'Created users API',
      };

      const result = merger.merge([frontendOutput, backendOutput]);

      expect(result.operations).toHaveLength(2);
      expect(result.conflicts).toHaveLength(0);
      expect(result.clean).toBe(true);
      expect(result.explanation).toContain('Created Button component');
      expect(result.explanation).toContain('Created users API');

      const paths = result.operations.map((op) => op.path);
      expect(paths).toContain('/src/components/Button.tsx');
      expect(paths).toContain('/src/api/users.ts');
    });

    it('should detect and resolve conflicts when agents modify the same file', () => {
      const frontendOutput: AgentFileOutput = {
        agentId: 'frontend-agent',
        taskId: 'task-1',
        operations: [
          { type: 'update', path: '/src/App.tsx', content: 'frontend version', language: 'typescriptreact' },
        ],
        explanation: 'Updated App from frontend',
      };

      const backendOutput: AgentFileOutput = {
        agentId: 'backend-agent',
        taskId: 'task-2',
        operations: [
          { type: 'update', path: '/src/App.tsx', content: 'backend version', language: 'typescriptreact' },
        ],
        explanation: 'Updated App from backend',
      };

      const result = merger.merge([frontendOutput, backendOutput]);

      expect(result.operations).toHaveLength(1);
      expect(result.conflicts).toHaveLength(1);
      expect(result.clean).toBe(false);

      // Last-writer-wins: backend was last
      expect(result.operations[0].content).toBe('backend version');
      expect(result.conflicts[0].path).toBe('/src/App.tsx');
      expect(result.conflicts[0].agentIds).toContain('frontend-agent');
      expect(result.conflicts[0].agentIds).toContain('backend-agent');
      expect(result.conflicts[0].resolvedFrom).toBe('backend-agent');
      expect(result.conflicts[0].strategy).toBe('last-writer-wins');
    });

    it('should handle mixed conflicting and non-conflicting files', () => {
      const frontendOutput: AgentFileOutput = {
        agentId: 'frontend-agent',
        taskId: 'task-1',
        operations: [
          { type: 'create', path: '/src/components/Header.tsx', content: 'header' },
          { type: 'update', path: '/src/shared/types.ts', content: 'frontend types' },
        ],
      };

      const backendOutput: AgentFileOutput = {
        agentId: 'backend-agent',
        taskId: 'task-2',
        operations: [
          { type: 'create', path: '/src/api/routes.ts', content: 'routes' },
          { type: 'update', path: '/src/shared/types.ts', content: 'backend types' },
        ],
      };

      const result = merger.merge([frontendOutput, backendOutput]);

      expect(result.operations).toHaveLength(3);
      expect(result.conflicts).toHaveLength(1);
      expect(result.clean).toBe(false);

      // The conflict should be on the shared types file
      expect(result.conflicts[0].path).toBe('/src/shared/types.ts');

      // Non-conflicting files should be present
      const paths = result.operations.map((op) => op.path);
      expect(paths).toContain('/src/components/Header.tsx');
      expect(paths).toContain('/src/api/routes.ts');
      expect(paths).toContain('/src/shared/types.ts');
    });

    it('should handle three agents conflicting on the same file', () => {
      const outputs: AgentFileOutput[] = [
        {
          agentId: 'agent-a',
          taskId: 'task-1',
          operations: [{ type: 'update', path: '/config.ts', content: 'version a' }],
        },
        {
          agentId: 'agent-b',
          taskId: 'task-2',
          operations: [{ type: 'update', path: '/config.ts', content: 'version b' }],
        },
        {
          agentId: 'agent-c',
          taskId: 'task-3',
          operations: [{ type: 'update', path: '/config.ts', content: 'version c' }],
        },
      ];

      const result = merger.merge(outputs);

      expect(result.operations).toHaveLength(1);
      expect(result.conflicts).toHaveLength(1);
      // Last writer wins: agent-c
      expect(result.operations[0].content).toBe('version c');
      expect(result.conflicts[0].resolvedFrom).toBe('agent-c');
      expect(result.conflicts[0].agentIds).toHaveLength(3);
    });
  });

  describe('detectOverlaps', () => {
    it('should return empty map when no overlaps exist', () => {
      const outputs: AgentFileOutput[] = [
        {
          agentId: 'agent-a',
          taskId: 'task-1',
          operations: [{ type: 'create', path: '/a.ts', content: '' }],
        },
        {
          agentId: 'agent-b',
          taskId: 'task-2',
          operations: [{ type: 'create', path: '/b.ts', content: '' }],
        },
      ];

      const overlaps = merger.detectOverlaps(outputs);
      expect(overlaps.size).toBe(0);
    });

    it('should detect overlapping paths', () => {
      const outputs: AgentFileOutput[] = [
        {
          agentId: 'frontend-agent',
          taskId: 'task-1',
          operations: [
            { type: 'create', path: '/shared.ts', content: '' },
            { type: 'create', path: '/unique-a.ts', content: '' },
          ],
        },
        {
          agentId: 'backend-agent',
          taskId: 'task-2',
          operations: [
            { type: 'update', path: '/shared.ts', content: '' },
            { type: 'create', path: '/unique-b.ts', content: '' },
          ],
        },
      ];

      const overlaps = merger.detectOverlaps(outputs);
      expect(overlaps.size).toBe(1);
      expect(overlaps.get('/shared.ts')).toEqual(['frontend-agent', 'backend-agent']);
    });
  });

  describe('toConflictInfos', () => {
    it('should convert merge conflicts to ConflictInfo format', () => {
      const result = merger.merge([
        {
          agentId: 'agent-a',
          taskId: 'task-1',
          operations: [{ type: 'update', path: '/file.ts', content: 'a' }],
        },
        {
          agentId: 'agent-b',
          taskId: 'task-2',
          operations: [{ type: 'update', path: '/file.ts', content: 'b' }],
        },
      ]);

      const infos = merger.toConflictInfos(result.conflicts);

      expect(infos).toHaveLength(1);
      expect(infos[0].resolved).toBe(true);
      expect(infos[0].agentIds).toEqual(['agent-a', 'agent-b']);
      expect(infos[0].taskIds).toEqual(['task-1', 'task-2']);
      expect(infos[0].description).toContain('/file.ts');
      expect(infos[0].description).toContain('last-writer-wins');
    });
  });

  describe('default strategy', () => {
    it('should use last-writer-wins by default', () => {
      const defaultMerger = new OutputMerger();
      const result = defaultMerger.merge([
        {
          agentId: 'first',
          taskId: 'task-1',
          operations: [{ type: 'create', path: '/f.ts', content: 'first' }],
        },
        {
          agentId: 'second',
          taskId: 'task-2',
          operations: [{ type: 'create', path: '/f.ts', content: 'second' }],
        },
      ]);

      expect(result.operations[0].content).toBe('second');
      expect(result.conflicts[0].strategy).toBe('last-writer-wins');
    });
  });
});
