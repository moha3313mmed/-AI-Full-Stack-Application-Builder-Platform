// ============================================================================
// IMemoryStore - Interface for project memory storage backends
// ============================================================================

import {
  type MemoryCategory,
  type MemoryQuery,
  type MemorySearchResult,
  type ProjectMemoryEntry,
} from '../types.js';

/**
 * Interface for memory storage implementations.
 * Supports CRUD operations, search, and category-based retrieval.
 */
export interface IMemoryStore {
  /**
   * Store a new memory entry.
   */
  store(entry: ProjectMemoryEntry): Promise<void>;

  /**
   * Retrieve a single entry by ID.
   */
  retrieve(id: string): Promise<ProjectMemoryEntry | null>;

  /**
   * Search entries using a query with keyword-based relevance scoring.
   */
  search(query: MemoryQuery): Promise<MemorySearchResult[]>;

  /**
   * Update an existing entry with partial data.
   */
  update(id: string, partial: Partial<ProjectMemoryEntry>): Promise<ProjectMemoryEntry | null>;

  /**
   * Delete an entry by ID.
   */
  delete(id: string): Promise<boolean>;

  /**
   * List all entries for a project with optional pagination.
   */
  listByProject(
    projectId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<ProjectMemoryEntry[]>;

  /**
   * Get all entries for a project in a specific category.
   */
  getByCategory(projectId: string, category: MemoryCategory): Promise<ProjectMemoryEntry[]>;
}
