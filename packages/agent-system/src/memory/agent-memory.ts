// ============================================================================
// AgentMemory - Short-term, long-term, and shared memory management
// ============================================================================

import { type MemoryEntry } from '../types/index.js';

/**
 * AgentMemory provides layered memory storage for agents:
 * - Short-term: Current task context (cleared after task completion)
 * - Long-term: Project history, architecture decisions, patterns
 * - Shared: Team knowledge accessible to all agents
 */
export class AgentMemory {
  private shortTerm: Map<string, MemoryEntry[]> = new Map();
  private longTerm: Map<string, MemoryEntry[]> = new Map();
  private shared: MemoryEntry[] = [];
  private maxShortTermPerAgent: number;
  private maxLongTermPerAgent: number;
  private maxShared: number;

  constructor(options?: {
    maxShortTermPerAgent?: number;
    maxLongTermPerAgent?: number;
    maxShared?: number;
  }) {
    this.maxShortTermPerAgent = options?.maxShortTermPerAgent ?? 50;
    this.maxLongTermPerAgent = options?.maxLongTermPerAgent ?? 200;
    this.maxShared = options?.maxShared ?? 500;
  }

  /**
   * Store a memory entry.
   */
  async store(entry: MemoryEntry): Promise<void> {
    switch (entry.type) {
      case 'short_term': {
        const entries = this.shortTerm.get(entry.agentId) ?? [];
        entries.push(entry);
        if (entries.length > this.maxShortTermPerAgent) {
          entries.shift();
        }
        this.shortTerm.set(entry.agentId, entries);
        break;
      }
      case 'long_term': {
        const entries = this.longTerm.get(entry.agentId) ?? [];
        entries.push(entry);
        if (entries.length > this.maxLongTermPerAgent) {
          entries.shift();
        }
        this.longTerm.set(entry.agentId, entries);
        break;
      }
      case 'shared': {
        this.shared.push(entry);
        if (this.shared.length > this.maxShared) {
          this.shared.shift();
        }
        break;
      }
    }
  }

  /**
   * Recall memories relevant to a query.
   * Uses simple keyword matching for now; can be upgraded to semantic search.
   */
  async recall(
    agentId: string,
    query: string,
    type?: MemoryEntry['type'],
    limit?: number,
  ): Promise<MemoryEntry[]> {
    const maxResults = limit ?? 10;
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter((k) => k.length > 2);
    let candidates: MemoryEntry[] = [];

    if (!type || type === 'short_term') {
      candidates = candidates.concat(this.shortTerm.get(agentId) ?? []);
    }
    if (!type || type === 'long_term') {
      candidates = candidates.concat(this.longTerm.get(agentId) ?? []);
    }
    if (!type || type === 'shared') {
      candidates = candidates.concat(this.shared);
    }

    // Score entries by keyword relevance
    const scored = candidates.map((entry) => {
      const contentLower = entry.content.toLowerCase();
      const score = keywords.reduce((acc, keyword) => {
        return acc + (contentLower.includes(keyword) ? 1 : 0);
      }, 0);
      return { entry: { ...entry, relevanceScore: score }, score };
    });

    // Sort by score descending, then by timestamp descending
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.entry.timestamp.getTime() - a.entry.timestamp.getTime();
    });

    return scored.slice(0, maxResults).map((s) => s.entry);
  }

  /**
   * Clear short-term memory for an agent (after task completion).
   */
  clearShortTerm(agentId: string): void {
    this.shortTerm.delete(agentId);
  }

  /**
   * Clear all memory for an agent.
   */
  clearAll(agentId: string): void {
    this.shortTerm.delete(agentId);
    this.longTerm.delete(agentId);
  }

  /**
   * Get all shared memories.
   */
  getSharedMemories(): MemoryEntry[] {
    return [...this.shared];
  }

  /**
   * Get the count of entries by type for an agent.
   */
  getMemoryStats(agentId: string): { shortTerm: number; longTerm: number; shared: number } {
    return {
      shortTerm: this.shortTerm.get(agentId)?.length ?? 0,
      longTerm: this.longTerm.get(agentId)?.length ?? 0,
      shared: this.shared.length,
    };
  }
}
