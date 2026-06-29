import { describe, it, expect, beforeEach } from 'vitest';

import { MemoryContextBuilder } from '../context-builder.js';
import { MemoryCategory, type MemorySearchResult, type ProjectMemoryEntry } from '../types.js';

describe('MemoryContextBuilder', () => {
  let builder: MemoryContextBuilder;

  function createEntry(overrides?: Partial<ProjectMemoryEntry>): ProjectMemoryEntry {
    return {
      id: crypto.randomUUID(),
      projectId: 'project-1',
      category: MemoryCategory.ARCHITECTURE,
      title: 'Test Entry',
      content: 'Test content',
      tags: ['test'],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      ...overrides,
    };
  }

  beforeEach(() => {
    builder = new MemoryContextBuilder();
  });

  describe('buildArchitectureContext', () => {
    it('should format architecture entries with header', () => {
      const entries = [
        createEntry({
          title: 'Microservices Architecture',
          content: 'Use event-driven microservices',
          metadata: { rationale: 'Better scalability and team autonomy' },
        }),
      ];

      const result = builder.buildArchitectureContext(entries);

      expect(result).toContain('## Architecture Decisions');
      expect(result).toContain('### Microservices Architecture');
      expect(result).toContain('Use event-driven microservices');
      expect(result).toContain('**Rationale:** Better scalability and team autonomy');
    });

    it('should return empty string for empty entries', () => {
      const result = builder.buildArchitectureContext([]);
      expect(result).toBe('');
    });

    it('should handle entries without rationale', () => {
      const entries = [
        createEntry({
          title: 'REST API Design',
          content: 'Follow RESTful conventions',
          metadata: {},
        }),
      ];

      const result = builder.buildArchitectureContext(entries);

      expect(result).toContain('### REST API Design');
      expect(result).not.toContain('**Rationale:**');
    });
  });

  describe('buildCodingStandardsContext', () => {
    it('should format coding standards with examples', () => {
      const entries = [
        createEntry({
          category: MemoryCategory.CODING_STANDARDS,
          title: 'Use named exports',
          metadata: { examples: ['export function foo() {}', 'export const bar = 42'] },
        }),
      ];

      const result = builder.buildCodingStandardsContext(entries);

      expect(result).toContain('## Coding Standards');
      expect(result).toContain('**Use named exports**');
      expect(result).toContain('Example: export function foo() {}');
      expect(result).toContain('Example: export const bar = 42');
    });

    it('should return empty string for empty entries', () => {
      const result = builder.buildCodingStandardsContext([]);
      expect(result).toBe('');
    });
  });

  describe('buildFullContext', () => {
    it('should group entries by category', () => {
      const entries = [
        createEntry({
          category: MemoryCategory.ARCHITECTURE,
          title: 'Arch Decision',
          content: 'Architecture content',
        }),
        createEntry({
          category: MemoryCategory.CODING_STANDARDS,
          title: 'Code Standard',
          content: 'Standards content',
        }),
        createEntry({
          category: MemoryCategory.BUSINESS_RULES,
          title: 'Business Rule',
          content: 'Rule content',
        }),
      ];

      const result = builder.buildFullContext(entries);

      expect(result).toContain('# Project Context');
      expect(result).toContain('## Architecture');
      expect(result).toContain('### Arch Decision');
      expect(result).toContain('## Coding Standards');
      expect(result).toContain('### Code Standard');
      expect(result).toContain('## Business Rules');
      expect(result).toContain('### Business Rule');
    });

    it('should return empty string for empty entries', () => {
      const result = builder.buildFullContext([]);
      expect(result).toBe('');
    });

    it('should handle multiple entries in the same category', () => {
      const entries = [
        createEntry({
          category: MemoryCategory.ARCHITECTURE,
          title: 'Decision 1',
          content: 'First decision',
        }),
        createEntry({
          category: MemoryCategory.ARCHITECTURE,
          title: 'Decision 2',
          content: 'Second decision',
        }),
      ];

      const result = builder.buildFullContext(entries);

      expect(result).toContain('### Decision 1');
      expect(result).toContain('### Decision 2');
      // Should only have one Architecture header
      const archCount = (result.match(/## Architecture/g) || []).length;
      expect(archCount).toBe(1);
    });
  });

  describe('buildRelevantContext', () => {
    it('should format search results with relevance scores', () => {
      const results: MemorySearchResult[] = [
        {
          entry: createEntry({ title: 'Relevant Entry', content: 'Important info' }),
          relevanceScore: 0.95,
        },
      ];

      const result = builder.buildRelevantContext('test query', results);

      expect(result).toContain('# Relevant Context for: test query');
      expect(result).toContain('### Relevant Entry (relevance: 0.95)');
      expect(result).toContain('Important info');
    });

    it('should respect token budget and truncate', () => {
      const longContent = 'x'.repeat(10000);
      const results: MemorySearchResult[] = [
        {
          entry: createEntry({ title: 'Long Entry', content: longContent }),
          relevanceScore: 0.8,
        },
      ];

      // Very small token budget
      const result = builder.buildRelevantContext('query', results, 100);

      // 100 tokens * 4 chars = 400 chars max
      expect(result.length).toBeLessThanOrEqual(400 + 10); // small buffer for truncation
    });

    it('should include multiple entries within budget', () => {
      const results: MemorySearchResult[] = [
        {
          entry: createEntry({ title: 'Entry 1', content: 'Short content 1' }),
          relevanceScore: 0.9,
        },
        {
          entry: createEntry({ title: 'Entry 2', content: 'Short content 2' }),
          relevanceScore: 0.7,
        },
      ];

      const result = builder.buildRelevantContext('query', results, 2000);

      expect(result).toContain('### Entry 1');
      expect(result).toContain('### Entry 2');
    });

    it('should return empty string for empty results', () => {
      const result = builder.buildRelevantContext('query', []);
      expect(result).toBe('');
    });

    it('should stop adding entries when budget is exceeded', () => {
      const results: MemorySearchResult[] = [];
      for (let i = 0; i < 20; i++) {
        results.push({
          entry: createEntry({
            title: `Entry ${i}`,
            content: 'A'.repeat(200),
          }),
          relevanceScore: 1 - i * 0.05,
        });
      }

      // Small budget - should only fit a few entries
      const result = builder.buildRelevantContext('query', results, 200);

      // Should not contain all 20 entries
      const entryCount = (result.match(/### Entry/g) || []).length;
      expect(entryCount).toBeLessThan(20);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      const text = 'Hello World'; // 11 chars
      const tokens = builder.estimateTokens(text);
      expect(tokens).toBe(Math.ceil(11 / 4));
    });

    it('should return 0 for empty string', () => {
      expect(builder.estimateTokens('')).toBe(0);
    });
  });
});
