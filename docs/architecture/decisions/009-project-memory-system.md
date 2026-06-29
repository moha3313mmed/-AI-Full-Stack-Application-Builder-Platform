# ADR 009: Project Memory System

## Status

Accepted

## Context

The AI Builder Platform needs persistent memory of project-level knowledge across sessions. Without this, each AI interaction starts from scratch with no awareness of prior architecture decisions, coding standards, user preferences, feature history, or business rules. This leads to inconsistent suggestions, repeated mistakes, and a poor developer experience.

Requirements include:

- Categorized storage for different types of project knowledge
- Fast retrieval by project, category, and keyword search
- Formatted output suitable for AI prompt enrichment with token budget awareness
- Testable in isolation without database dependencies
- Clear upgrade path from simple keyword matching to semantic/embedding-based search

Options considered:
- **Flat key-value store**: Simple but lacks categorization and search
- **Full vector database (Pinecone, Weaviate)**: Powerful semantic search but adds infrastructure complexity for MVP
- **Category-based memory with keyword search**: Balances structure with simplicity, upgradeable later
- **Inline context in conversation history**: No persistence across sessions

## Decision

We will implement a dedicated `@builder/memory` package (`packages/memory/`) that provides persistent project memory with category-based organization and keyword-based search.

### Core Components

1. **`MemoryCategory` enum** (`src/types.ts`): Eight categories for organizing entries: `ARCHITECTURE`, `CODING_STANDARDS`, `USER_PREFERENCES`, `FEATURE_HISTORY`, `BUSINESS_RULES`, `DESIGN_LANGUAGE`, `DATABASE_EVOLUTION`, `DECISIONS`.

2. **`IMemoryStore` interface** (`src/store/memory-store.interface.ts`): Abstract storage contract with operations: `store`, `retrieve`, `search`, `update`, `delete`, `listByProject`, `getByCategory`. Enables multiple backend implementations.

3. **`InMemoryStore`** (`src/store/in-memory-store.ts`): Map-based implementation for testing and fast access. Includes keyword-based relevance scoring on title, content, and tags fields.

4. **`ProjectMemory`** (`src/project-memory.ts`): High-level facade wrapping `IMemoryStore` with domain-specific methods: `addDecision`, `addCodingStandard`, `addPreference`, `recordFeature`, `addBusinessRule`, `getProjectContext`. Generates proper entry structure with IDs, timestamps, versioning, and metadata.

5. **`MemoryContextBuilder`** (`src/context-builder.ts`): Formats memory entries into structured markdown text for AI prompt injection. Includes `buildArchitectureContext()`, `buildCodingStandardsContext()`, `buildFullContext()`, and `buildRelevantContext(query, entries, maxTokens)` with token budget awareness using a characters-per-token estimation model.

### Data Model

```typescript
interface ProjectMemoryEntry {
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
```

### Persistence Layer

A database-backed implementation is provided via Prisma in the API layer (`apps/api/src/modules/memory/`). The `ProjectMemory` Prisma model stores entries with indexes on `projectId`, `category`, and a composite `[projectId, category]` index for efficient retrieval. The API exposes RESTful endpoints at `/projects/:projectId/memory/*` for CRUD operations and aggregated context retrieval.

## Consequences

### Positive

- AI agents have rich project context available at prompt time, producing more consistent and relevant suggestions
- Decisions and standards persist across sessions, preventing repeated mistakes
- Category-based organization enables targeted context retrieval without overwhelming the token budget
- The `MemoryContextBuilder` formats context with token awareness, preventing prompt overflow
- `IMemoryStore` interface enables easy testing with `InMemoryStore` and production use with database-backed store
- Domain-specific facade methods (`addDecision`, `addCodingStandard`, etc.) enforce consistent entry structure

### Negative

- Memory growth needs management over time as projects accumulate entries
- Keyword-based search has limitations compared to embedding-based semantic search (misses synonyms, contextual similarity)
- Token budget estimation uses a simple characters-per-token heuristic rather than actual tokenizer output
- Each category query in `getProjectContext` is a separate store call, which may be inefficient at scale

### Neutral

- Clear upgrade path to vector embeddings when needed, as the `IMemoryStore` interface can be implemented with a vector database backend
- The InMemoryStore uses the same keyword relevance scoring approach as `agent-system`'s AgentMemory, maintaining consistency across the codebase
- Memory entries are versioned, supporting future conflict resolution or history tracking
