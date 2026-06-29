import { describe, it, expect, beforeEach } from 'vitest';

import { AgentMemory } from '../memory/agent-memory.js';
import { type MemoryEntry } from '../types/index.js';

describe('AgentMemory', () => {
  let memory: AgentMemory;

  beforeEach(() => {
    memory = new AgentMemory({
      maxShortTermPerAgent: 5,
      maxLongTermPerAgent: 10,
      maxShared: 20,
    });
  });

  function createEntry(overrides?: Partial<MemoryEntry>): MemoryEntry {
    return {
      id: crypto.randomUUID(),
      agentId: 'agent-1',
      type: 'short_term',
      content: 'Test memory content',
      metadata: {},
      timestamp: new Date(),
      ...overrides,
    };
  }

  describe('store', () => {
    it('should store short-term memories', async () => {
      const entry = createEntry({ type: 'short_term' });
      await memory.store(entry);

      const stats = memory.getMemoryStats('agent-1');
      expect(stats.shortTerm).toBe(1);
    });

    it('should store long-term memories', async () => {
      const entry = createEntry({ type: 'long_term' });
      await memory.store(entry);

      const stats = memory.getMemoryStats('agent-1');
      expect(stats.longTerm).toBe(1);
    });

    it('should store shared memories', async () => {
      const entry = createEntry({ type: 'shared' });
      await memory.store(entry);

      const stats = memory.getMemoryStats('agent-1');
      expect(stats.shared).toBe(1);
    });

    it('should respect max short-term limit', async () => {
      for (let i = 0; i < 10; i++) {
        await memory.store(createEntry({ id: `entry-${i}`, type: 'short_term' }));
      }

      const stats = memory.getMemoryStats('agent-1');
      expect(stats.shortTerm).toBe(5);
    });

    it('should respect max long-term limit', async () => {
      for (let i = 0; i < 15; i++) {
        await memory.store(createEntry({ id: `entry-${i}`, type: 'long_term' }));
      }

      const stats = memory.getMemoryStats('agent-1');
      expect(stats.longTerm).toBe(10);
    });
  });

  describe('recall', () => {
    it('should recall memories by keyword relevance', async () => {
      await memory.store(createEntry({ content: 'React component for user dashboard' }));
      await memory.store(createEntry({ content: 'Database schema for products' }));
      await memory.store(createEntry({ content: 'React hooks for authentication' }));

      const results = await memory.recall('agent-1', 'React component');
      expect(results.length).toBeGreaterThan(0);
      // The React entries should score higher
      expect(results[0].content).toContain('React');
    });

    it('should filter by memory type', async () => {
      await memory.store(createEntry({ type: 'short_term', content: 'Short term task' }));
      await memory.store(createEntry({ type: 'long_term', content: 'Long term decision' }));

      const shortResults = await memory.recall('agent-1', 'term', 'short_term');
      expect(shortResults.every((r) => r.type === 'short_term')).toBe(true);

      const longResults = await memory.recall('agent-1', 'term', 'long_term');
      expect(longResults.every((r) => r.type === 'long_term')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await memory.store(createEntry({ content: `Memory entry ${i} about testing`, type: 'long_term' }));
      }

      const results = await memory.recall('agent-1', 'testing', undefined, 3);
      expect(results.length).toBe(3);
    });

    it('should include shared memories in recall', async () => {
      await memory.store(
        createEntry({
          agentId: 'agent-2',
          type: 'shared',
          content: 'Shared architecture decision about microservices',
        }),
      );

      const results = await memory.recall('agent-1', 'architecture microservices');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('microservices');
    });
  });

  describe('clearShortTerm', () => {
    it('should clear only short-term memory for an agent', async () => {
      await memory.store(createEntry({ type: 'short_term' }));
      await memory.store(createEntry({ type: 'long_term' }));

      memory.clearShortTerm('agent-1');

      const stats = memory.getMemoryStats('agent-1');
      expect(stats.shortTerm).toBe(0);
      expect(stats.longTerm).toBe(1);
    });
  });

  describe('clearAll', () => {
    it('should clear all memory for an agent', async () => {
      await memory.store(createEntry({ type: 'short_term' }));
      await memory.store(createEntry({ type: 'long_term' }));

      memory.clearAll('agent-1');

      const stats = memory.getMemoryStats('agent-1');
      expect(stats.shortTerm).toBe(0);
      expect(stats.longTerm).toBe(0);
    });
  });

  describe('getSharedMemories', () => {
    it('should return all shared memories', async () => {
      await memory.store(createEntry({ agentId: 'agent-1', type: 'shared', content: 'shared 1' }));
      await memory.store(createEntry({ agentId: 'agent-2', type: 'shared', content: 'shared 2' }));

      const shared = memory.getSharedMemories();
      expect(shared.length).toBe(2);
    });
  });
});
