// ============================================================================
// Project Memory Types
// ============================================================================

/**
 * Categories for organizing project memory entries.
 */
export enum MemoryCategory {
  ARCHITECTURE = 'ARCHITECTURE',
  CODING_STANDARDS = 'CODING_STANDARDS',
  USER_PREFERENCES = 'USER_PREFERENCES',
  FEATURE_HISTORY = 'FEATURE_HISTORY',
  BUSINESS_RULES = 'BUSINESS_RULES',
  DESIGN_LANGUAGE = 'DESIGN_LANGUAGE',
  DATABASE_EVOLUTION = 'DATABASE_EVOLUTION',
  DECISIONS = 'DECISIONS',
}

/**
 * A single entry in project memory.
 */
export interface ProjectMemoryEntry {
  id: string;
  projectId: string;
  category: MemoryCategory;
  title: string;
  content: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * Query parameters for searching project memory.
 */
export interface MemoryQuery {
  projectId: string;
  categories?: MemoryCategory[];
  searchText?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

/**
 * A search result with relevance scoring.
 */
export interface MemorySearchResult {
  entry: ProjectMemoryEntry;
  relevanceScore: number;
}
