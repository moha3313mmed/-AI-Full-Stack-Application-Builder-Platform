import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SharedContext } from '../collaboration/shared-context.js';

describe('SharedContext', () => {
  let context: SharedContext;

  beforeEach(() => {
    context = new SharedContext();
  });

  describe('set and get', () => {
    it('should store and retrieve a value', () => {
      context.set('architecture', { pattern: 'microservices' }, 'architect-1');

      const entry = context.get('architecture');
      expect(entry).toBeDefined();
      expect(entry!.value).toEqual({ pattern: 'microservices' });
      expect(entry!.agentId).toBe('architect-1');
      expect(entry!.updatedAt).toBeInstanceOf(Date);
    });

    it('should return undefined for non-existent keys', () => {
      const entry = context.get('nonexistent');
      expect(entry).toBeUndefined();
    });

    it('should overwrite values on update', () => {
      context.set('config', { version: 1 }, 'agent-1');
      context.set('config', { version: 2 }, 'agent-2');

      const entry = context.get('config');
      expect(entry!.value).toEqual({ version: 2 });
      expect(entry!.agentId).toBe('agent-2');
    });

    it('should store different types of values', () => {
      context.set('string', 'hello', 'agent-1');
      context.set('number', 42, 'agent-1');
      context.set('array', [1, 2, 3], 'agent-1');
      context.set('null', null, 'agent-1');

      expect(context.get('string')!.value).toBe('hello');
      expect(context.get('number')!.value).toBe(42);
      expect(context.get('array')!.value).toEqual([1, 2, 3]);
      expect(context.get('null')!.value).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return all entries', () => {
      context.set('key1', 'value1', 'agent-1');
      context.set('key2', 'value2', 'agent-2');

      const all = context.getAll();
      expect(all.size).toBe(2);
      expect(all.get('key1')!.value).toBe('value1');
      expect(all.get('key2')!.value).toBe('value2');
    });

    it('should return empty map for empty context', () => {
      const all = context.getAll();
      expect(all.size).toBe(0);
    });

    it('should return a copy (not reference to internal map)', () => {
      context.set('key1', 'value1', 'agent-1');
      const all = context.getAll();
      all.delete('key1');

      // Internal map should not be affected
      expect(context.get('key1')).toBeDefined();
    });
  });

  describe('subscription notifications', () => {
    it('should notify subscribers on value set', () => {
      const callback = vi.fn();
      context.subscribe('tasks', callback);

      context.set('tasks', ['task-1', 'task-2'], 'agent-1');

      expect(callback).toHaveBeenCalledWith(['task-1', 'task-2'], 'agent-1');
    });

    it('should notify subscribers on value update', () => {
      const callback = vi.fn();
      context.subscribe('status', callback);

      context.set('status', 'pending', 'agent-1');
      context.set('status', 'complete', 'agent-2');

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith('complete', 'agent-2');
    });

    it('should support multiple subscribers for same key', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      context.subscribe('shared', callback1);
      context.subscribe('shared', callback2);

      context.set('shared', 'data', 'agent-1');

      expect(callback1).toHaveBeenCalledWith('data', 'agent-1');
      expect(callback2).toHaveBeenCalledWith('data', 'agent-1');
    });

    it('should not notify unsubscribed callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = context.subscribe('key', callback);

      context.set('key', 'value1', 'agent-1');
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      context.set('key', 'value2', 'agent-2');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not notify subscribers of different keys', () => {
      const callback = vi.fn();
      context.subscribe('key-a', callback);

      context.set('key-b', 'value', 'agent-1');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('merge', () => {
    it('should merge another context into this one', () => {
      context.set('key1', 'value1', 'agent-1');

      const other = new SharedContext();
      other.set('key2', 'value2', 'agent-2');
      other.set('key3', 'value3', 'agent-3');

      context.merge(other);

      expect(context.get('key1')!.value).toBe('value1');
      expect(context.get('key2')!.value).toBe('value2');
      expect(context.get('key3')!.value).toBe('value3');
    });

    it('should overwrite existing keys on merge', () => {
      context.set('config', { version: 1 }, 'agent-1');

      const other = new SharedContext();
      other.set('config', { version: 2 }, 'agent-2');

      context.merge(other);

      expect(context.get('config')!.value).toEqual({ version: 2 });
      expect(context.get('config')!.agentId).toBe('agent-2');
    });

    it('should notify subscribers during merge', () => {
      const callback = vi.fn();
      context.subscribe('merged-key', callback);

      const other = new SharedContext();
      other.set('merged-key', 'merged-value', 'agent-2');

      context.merge(other);

      expect(callback).toHaveBeenCalledWith('merged-value', 'agent-2');
    });
  });

  describe('getContributors', () => {
    it('should return unique agent IDs', () => {
      context.set('key1', 'v1', 'agent-1');
      context.set('key2', 'v2', 'agent-2');
      context.set('key3', 'v3', 'agent-1');
      context.set('key4', 'v4', 'agent-3');

      const contributors = context.getContributors();
      expect(contributors).toHaveLength(3);
      expect(contributors).toContain('agent-1');
      expect(contributors).toContain('agent-2');
      expect(contributors).toContain('agent-3');
    });

    it('should return empty array for empty context', () => {
      const contributors = context.getContributors();
      expect(contributors).toHaveLength(0);
    });

    it('should track the latest contributor per key', () => {
      context.set('key1', 'v1', 'agent-1');
      context.set('key1', 'v2', 'agent-2');

      const contributors = context.getContributors();
      // Only agent-2 contributed (key1 was overwritten)
      expect(contributors).toHaveLength(1);
      expect(contributors).toContain('agent-2');
    });
  });

  describe('size and clear', () => {
    it('should report correct size', () => {
      expect(context.size()).toBe(0);
      context.set('key1', 'v1', 'agent-1');
      expect(context.size()).toBe(1);
      context.set('key2', 'v2', 'agent-2');
      expect(context.size()).toBe(2);
    });

    it('should clear all entries and subscriptions', () => {
      const callback = vi.fn();
      context.set('key1', 'v1', 'agent-1');
      context.subscribe('key1', callback);

      context.clear();

      expect(context.size()).toBe(0);
      expect(context.get('key1')).toBeUndefined();

      // Subscriber should no longer be called after clear
      context.set('key1', 'v2', 'agent-2');
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
