// ============================================================================
// ProjectMemory - Facade for project memory management
// ============================================================================

import { generateId } from '@builder/shared';

import { type IMemoryStore } from './store/memory-store.interface.js';
import {
  MemoryCategory,
  type MemoryQuery,
  type MemorySearchResult,
  type ProjectMemoryEntry,
} from './types.js';

/**
 * ProjectMemory provides a high-level API for managing project memory.
 * It wraps an IMemoryStore implementation and adds domain-specific methods
 * for common memory operations.
 */
export class ProjectMemory {
  constructor(private readonly store: IMemoryStore) {}

  /**
   * Add an architecture or design decision to project memory.
   */
  async addDecision(
    projectId: string,
    title: string,
    content: string,
    rationale: string,
  ): Promise<ProjectMemoryEntry> {
    const entry: ProjectMemoryEntry = {
      id: generateId(),
      projectId,
      category: MemoryCategory.DECISIONS,
      title,
      content,
      tags: ['decision'],
      metadata: { rationale },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };

    await this.store.store(entry);
    return entry;
  }

  /**
   * Add a coding standard or convention rule.
   */
  async addCodingStandard(
    projectId: string,
    rule: string,
    examples: string[],
  ): Promise<ProjectMemoryEntry> {
    const entry: ProjectMemoryEntry = {
      id: generateId(),
      projectId,
      category: MemoryCategory.CODING_STANDARDS,
      title: rule,
      content: `Rule: ${rule}\n\nExamples:\n${examples.map((e) => `- ${e}`).join('\n')}`,
      tags: ['coding-standard', 'convention'],
      metadata: { examples },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };

    await this.store.store(entry);
    return entry;
  }

  /**
   * Add a user preference.
   */
  async addPreference(
    projectId: string,
    key: string,
    value: string,
  ): Promise<ProjectMemoryEntry> {
    const entry: ProjectMemoryEntry = {
      id: generateId(),
      projectId,
      category: MemoryCategory.USER_PREFERENCES,
      title: key,
      content: value,
      tags: ['preference', key],
      metadata: { key, value },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };

    await this.store.store(entry);
    return entry;
  }

  /**
   * Record a feature implementation in project history.
   */
  async recordFeature(
    projectId: string,
    featureName: string,
    description: string,
    relatedFiles: string[],
  ): Promise<ProjectMemoryEntry> {
    const entry: ProjectMemoryEntry = {
      id: generateId(),
      projectId,
      category: MemoryCategory.FEATURE_HISTORY,
      title: featureName,
      content: description,
      tags: ['feature', ...relatedFiles.map((f) => f.split('/').pop() ?? f)],
      metadata: { relatedFiles },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };

    await this.store.store(entry);
    return entry;
  }

  /**
   * Add a business rule to project memory.
   */
  async addBusinessRule(
    projectId: string,
    rule: string,
    context: string,
  ): Promise<ProjectMemoryEntry> {
    const entry: ProjectMemoryEntry = {
      id: generateId(),
      projectId,
      category: MemoryCategory.BUSINESS_RULES,
      title: rule,
      content: `Rule: ${rule}\n\nContext: ${context}`,
      tags: ['business-rule'],
      metadata: { context },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };

    await this.store.store(entry);
    return entry;
  }

  /**
   * Get a comprehensive project context summary across all categories.
   * Useful for enriching AI prompts with project knowledge.
   */
  async getProjectContext(projectId: string): Promise<Map<MemoryCategory, ProjectMemoryEntry[]>> {
    const context = new Map<MemoryCategory, ProjectMemoryEntry[]>();

    for (const category of Object.values(MemoryCategory)) {
      const entries = await this.store.getByCategory(projectId, category);
      if (entries.length > 0) {
        context.set(category, entries);
      }
    }

    return context;
  }

  /**
   * Search project memory with a query.
   */
  async search(query: MemoryQuery): Promise<MemorySearchResult[]> {
    return this.store.search(query);
  }

  /**
   * Retrieve a specific entry by ID.
   */
  async retrieve(id: string): Promise<ProjectMemoryEntry | null> {
    return this.store.retrieve(id);
  }

  /**
   * Update an existing entry.
   */
  async update(
    id: string,
    partial: Partial<ProjectMemoryEntry>,
  ): Promise<ProjectMemoryEntry | null> {
    return this.store.update(id, partial);
  }

  /**
   * Delete an entry by ID.
   */
  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}
