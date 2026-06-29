import { describe, it, expect, beforeEach, vi } from 'vitest';

import { EventBus } from '../communication/event-bus.js';
import { ConflictResolver, type ConflictCheck } from '../conflict/resolver.js';
import { MessageType } from '../types/index.js';

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    resolver = new ConflictResolver(eventBus);
  });

  describe('registerOutput', () => {
    it('should not detect conflict with a single output', () => {
      const check: ConflictCheck = {
        taskId: 'task-1',
        agentId: 'agent-1',
        output: { endpoint: '/api/users' },
        outputType: 'api_implementation',
      };

      const conflict = resolver.registerOutput(check);
      expect(conflict).toBeNull();
    });

    it('should detect schema conflicts with same field name but different types', () => {
      const check1: ConflictCheck = {
        taskId: 'task-1',
        agentId: 'agent-1',
        output: { email: 'string', age: 'number' },
        outputType: 'schema',
      };

      const check2: ConflictCheck = {
        taskId: 'task-2',
        agentId: 'agent-2',
        output: { email: 'string', age: 'string' },
        outputType: 'schema',
      };

      resolver.registerOutput(check1);
      const conflict = resolver.registerOutput(check2);

      expect(conflict).not.toBeNull();
      expect(conflict!.agentIds).toContain('agent-1');
      expect(conflict!.agentIds).toContain('agent-2');
      expect(conflict!.description).toContain('Schema conflict');
      expect(conflict!.resolved).toBe(false);
    });
  });

  describe('custom detector', () => {
    it('should support custom conflict detectors', () => {
      resolver.addDetector((outputs) => {
        if (outputs.length >= 2) {
          return {
            id: crypto.randomUUID(),
            agentIds: outputs.map((o) => o.agentId),
            taskIds: outputs.map((o) => o.taskId),
            description: 'Custom conflict detected',
            conflictingOutputs: outputs.map((o) => o.output),
            resolved: false,
          };
        }
        return null;
      });

      const check1: ConflictCheck = {
        taskId: 'task-1',
        agentId: 'agent-1',
        output: { data: 'a' },
        outputType: 'custom_type',
      };

      const check2: ConflictCheck = {
        taskId: 'task-2',
        agentId: 'agent-2',
        output: { data: 'b' },
        outputType: 'custom_type',
      };

      resolver.registerOutput(check1);
      const conflict = resolver.registerOutput(check2);

      expect(conflict).not.toBeNull();
      expect(conflict!.description).toBe('Custom conflict detected');
    });
  });

  describe('resolve', () => {
    it('should mark a conflict as resolved', () => {
      // Use custom detector to ensure we get a conflict
      resolver.addDetector((outputs) => {
        if (outputs.length >= 2) {
          return {
            id: 'conflict-123',
            agentIds: outputs.map((o) => o.agentId),
            taskIds: outputs.map((o) => o.taskId),
            description: 'Test conflict',
            conflictingOutputs: outputs.map((o) => o.output),
            resolved: false,
          };
        }
        return null;
      });

      resolver.registerOutput({
        taskId: 'task-1',
        agentId: 'agent-1',
        output: { x: 1 },
        outputType: 'test_type',
      });
      resolver.registerOutput({
        taskId: 'task-2',
        agentId: 'agent-2',
        output: { x: 2 },
        outputType: 'test_type',
      });

      const resolved = resolver.resolve('conflict-123', { x: 3 });
      expect(resolved).toBe(true);

      const conflict = resolver.getConflict('conflict-123');
      expect(conflict!.resolved).toBe(true);
      expect(conflict!.resolvedOutput).toEqual({ x: 3 });
    });

    it('should return false for non-existent conflict', () => {
      expect(resolver.resolve('nonexistent', {})).toBe(false);
    });
  });

  describe('getUnresolved', () => {
    it('should return only unresolved conflicts', () => {
      resolver.addDetector((outputs) => {
        if (outputs.length >= 2) {
          return {
            id: `conflict-${Date.now()}`,
            agentIds: outputs.map((o) => o.agentId),
            taskIds: outputs.map((o) => o.taskId),
            description: 'Test conflict',
            conflictingOutputs: outputs.map((o) => o.output),
            resolved: false,
          };
        }
        return null;
      });

      // Create two conflicts in different groups
      resolver.registerOutput({ taskId: 't1', agentId: 'a1', output: {}, outputType: 'group_a' });
      resolver.registerOutput({ taskId: 't2', agentId: 'a2', output: {}, outputType: 'group_a' });

      const unresolved = resolver.getUnresolved();
      expect(unresolved.length).toBe(1);

      // Resolve one
      resolver.resolve(unresolved[0].id, { merged: true });
      expect(resolver.getUnresolved().length).toBe(0);
    });
  });

  describe('event bus integration', () => {
    it('should publish conflict detected message on event bus', () => {
      const handler = vi.fn();
      eventBus.subscribe(MessageType.CONFLICT_DETECTED, handler);

      resolver.addDetector((outputs) => {
        if (outputs.length >= 2) {
          return {
            id: 'conflict-event-test',
            agentIds: outputs.map((o) => o.agentId),
            taskIds: outputs.map((o) => o.taskId),
            description: 'Conflict for event test',
            conflictingOutputs: outputs.map((o) => o.output),
            resolved: false,
          };
        }
        return null;
      });

      resolver.registerOutput({ taskId: 't1', agentId: 'a1', output: {}, outputType: 'event_test' });
      resolver.registerOutput({ taskId: 't2', agentId: 'a2', output: {}, outputType: 'event_test' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].type).toBe(MessageType.CONFLICT_DETECTED);
    });
  });
});
