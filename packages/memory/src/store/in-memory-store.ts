// ============================================================================
// InMemoryStore - Map-based implementation of IMemoryStore
// ============================================================================

import {
  type MemoryCategory,
  type MemoryQuery,
  type MemorySearchResult,
  type ProjectMemoryEntry,
} from '../types.js';

import { type IMemoryStore } from './memory-store.interface.js';

/**
 * In-memory implementation of IMemoryStore using Maps.
 * Provides keyword-based relevance scoring for search operations.
 */
export class InMemoryStore implements IMemoryStore {
  private entries: Map<string, ProjectMemoryEntry> = new Map();

  async store(entry: ProjectMemoryEntry): Promise<void> {
    this.entries.set(entry.id, { ...entry });
  }

  async retrieve(id: string): Promise<ProjectMemoryEntry | null> {
    const entry = this.entries.get(id);
    return entry ? { ...entry } : null;
  }

  async search(query: MemoryQuery): Promise<MemorySearchResult[]> {
    const limit = query.limit ?? 10;
    const offset = query.offset ?? 0;

    // Filter candidates by projectId, categories, and tags
    let candidates = Array.from(this.entries.values()).filter(
      (entry) => entry.projectId === query.projectId,
    );

    if (query.categories && query.categories.length > 0) {
      candidates = candidates.filter((entry) => query.categories!.includes(entry.category));
    }

    if (query.tags && query.tags.length > 0) {
      candidates = candidates.filter((entry) =>
        query.tags!.some((tag) => entry.tags.includes(tag)),
      );
    }

    // Score entries by keyword relevance
    const scored: MemorySearchResult[] = candidates.map((entry) => {
      const score = this.calculateRelevanceScore(entry, query.searchText);
      return { entry: { ...entry }, relevanceScore: score };
    });

    // Sort by relevance score descending, then by updatedAt descending
    scored.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return b.entry.updatedAt.getTime() - a.entry.updatedAt.getTime();
    });

    return scored.slice(offset, offset + limit);
  }

  async update(
    id: string,
    partial: Partial<ProjectMemoryEntry>,
  ): Promise<ProjectMemoryEntry | null> {
    const existing = this.entries.get(id);
    if (!existing) {
      return null;
    }

    const updated: ProjectMemoryEntry = {
      ...existing,
      ...partial,
      id: existing.id, // Prevent ID changes
      updatedAt: new Date(),
      version: existing.version + 1,
    };

    this.entries.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  async listByProject(
    projectId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<ProjectMemoryEntry[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const projectEntries = Array.from(this.entries.values())
      .filter((entry) => entry.projectId === projectId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return projectEntries.slice(offset, offset + limit).map((entry) => ({ ...entry }));
  }

  async getByCategory(
    projectId: string,
    category: MemoryCategory,
  ): Promise<ProjectMemoryEntry[]> {
    return Array.from(this.entries.values())
      .filter((entry) => entry.projectId === projectId && entry.category === category)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((entry) => ({ ...entry }));
  }

  /**
   * Calculate relevance score using keyword matching.
   * Similar to the recall() method in packages/agent-system/src/memory/agent-memory.ts.
   */
  private calculateRelevanceScore(entry: ProjectMemoryEntry, searchText?: string): number {
    if (!searchText) {
      return 1; // Default score when no search text is provided
    }

    const queryLower = searchText.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter((k) => k.length > 2);

    if (keywords.length === 0) {
      return 1;
    }

    const titleLower = entry.title.toLowerCase();
    const contentLower = entry.content.toLowerCase();
    const tagsLower = entry.tags.map((t) => t.toLowerCase());

    let score = 0;

    for (const keyword of keywords) {
      // Title matches are worth more
      if (titleLower.includes(keyword)) {
        score += 3;
      }
      // Content matches
      if (contentLower.includes(keyword)) {
        score += 1;
      }
      // Tag matches are worth more
      if (tagsLower.some((tag) => tag.includes(keyword))) {
        score += 2;
      }
    }

    // Normalize score by number of keywords
    return score / keywords.length;
  }
}
