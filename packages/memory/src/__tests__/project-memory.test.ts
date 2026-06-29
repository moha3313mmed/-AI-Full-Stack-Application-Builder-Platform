import { describe, it, expect, beforeEach } from 'vitest';

import { ProjectMemory } from '../project-memory.js';
import { InMemoryStore } from '../store/in-memory-store.js';
import { MemoryCategory } from '../types.js';

describe('ProjectMemory', () => {
  let memory: ProjectMemory;
  let store: InMemoryStore;
  const projectId = 'test-project';

  beforeEach(() => {
    store = new InMemoryStore();
    memory = new ProjectMemory(store);
  });

  describe('addDecision', () => {
    it('should add a decision entry to memory', async () => {
      const entry = await memory.addDecision(
        projectId,
        'Use PostgreSQL',
        'We chose PostgreSQL for its JSONB support and reliability',
        'JSONB allows flexible schema while maintaining ACID compliance',
      );

      expect(entry.id).toBeDefined();
      expect(entry.projectId).toBe(projectId);
      expect(entry.category).toBe(MemoryCategory.DECISIONS);
      expect(entry.title).toBe('Use PostgreSQL');
      expect(entry.content).toBe('We chose PostgreSQL for its JSONB support and reliability');
      expect(entry.metadata['rationale']).toBe(
        'JSONB allows flexible schema while maintaining ACID compliance',
      );
    });

    it('should be retrievable after storing', async () => {
      const entry = await memory.addDecision(
        projectId,
        'Monorepo Structure',
        'Use Turborepo for monorepo management',
        'Better dependency management and build caching',
      );

      const retrieved = await memory.retrieve(entry.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.title).toBe('Monorepo Structure');
    });

    it('should be searchable', async () => {
      await memory.addDecision(
        projectId,
        'Use PostgreSQL',
        'Relational database for structured data',
        'ACID compliance needed',
      );
      await memory.addDecision(
        projectId,
        'Use Redis',
        'In-memory cache for sessions',
        'Low latency requirements',
      );

      const results = await memory.search({
        projectId,
        searchText: 'database relational',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.title).toBe('Use PostgreSQL');
    });
  });

  describe('addCodingStandard', () => {
    it('should add a coding standard entry', async () => {
      const entry = await memory.addCodingStandard(
        projectId,
        'Use named exports over default exports',
        ['export function myFunction() {}', 'export const MY_CONSTANT = 42'],
      );

      expect(entry.category).toBe(MemoryCategory.CODING_STANDARDS);
      expect(entry.title).toBe('Use named exports over default exports');
      expect(entry.metadata['examples']).toEqual([
        'export function myFunction() {}',
        'export const MY_CONSTANT = 42',
      ]);
    });

    it('should include examples in content', async () => {
      const entry = await memory.addCodingStandard(
        projectId,
        'Always use explicit return types',
        ['function greet(): string { return "hello"; }'],
      );

      expect(entry.content).toContain('Always use explicit return types');
      expect(entry.content).toContain('function greet(): string');
    });
  });

  describe('addPreference', () => {
    it('should add a user preference', async () => {
      const entry = await memory.addPreference(projectId, 'theme', 'dark');

      expect(entry.category).toBe(MemoryCategory.USER_PREFERENCES);
      expect(entry.title).toBe('theme');
      expect(entry.content).toBe('dark');
      expect(entry.metadata['key']).toBe('theme');
      expect(entry.metadata['value']).toBe('dark');
    });

    it('should store multiple preferences', async () => {
      await memory.addPreference(projectId, 'theme', 'dark');
      await memory.addPreference(projectId, 'language', 'TypeScript');
      await memory.addPreference(projectId, 'indentation', '2 spaces');

      const results = await memory.search({
        projectId,
        categories: [MemoryCategory.USER_PREFERENCES],
      });

      expect(results.length).toBe(3);
    });
  });

  describe('recordFeature', () => {
    it('should record a feature implementation', async () => {
      const entry = await memory.recordFeature(
        projectId,
        'User Authentication',
        'JWT-based auth with refresh tokens',
        ['src/auth/auth.service.ts', 'src/auth/jwt.strategy.ts'],
      );

      expect(entry.category).toBe(MemoryCategory.FEATURE_HISTORY);
      expect(entry.title).toBe('User Authentication');
      expect(entry.content).toBe('JWT-based auth with refresh tokens');
      expect(entry.metadata['relatedFiles']).toEqual([
        'src/auth/auth.service.ts',
        'src/auth/jwt.strategy.ts',
      ]);
    });

    it('should include file names as tags', async () => {
      const entry = await memory.recordFeature(
        projectId,
        'User Dashboard',
        'Main dashboard with widgets',
        ['src/components/Dashboard.tsx'],
      );

      expect(entry.tags).toContain('feature');
      expect(entry.tags).toContain('Dashboard.tsx');
    });
  });

  describe('addBusinessRule', () => {
    it('should add a business rule', async () => {
      const entry = await memory.addBusinessRule(
        projectId,
        'Users must verify email before accessing premium features',
        'Security compliance requirement from legal team',
      );

      expect(entry.category).toBe(MemoryCategory.BUSINESS_RULES);
      expect(entry.title).toBe('Users must verify email before accessing premium features');
      expect(entry.content).toContain('Security compliance requirement from legal team');
      expect(entry.metadata['context']).toBe(
        'Security compliance requirement from legal team',
      );
    });
  });

  describe('getProjectContext', () => {
    it('should aggregate entries across all categories', async () => {
      await memory.addDecision(projectId, 'Decision 1', 'Content', 'Reason');
      await memory.addCodingStandard(projectId, 'Standard 1', ['example']);
      await memory.addPreference(projectId, 'pref-key', 'pref-value');
      await memory.recordFeature(projectId, 'Feature 1', 'Description', ['file.ts']);
      await memory.addBusinessRule(projectId, 'Rule 1', 'Context');

      const context = await memory.getProjectContext(projectId);

      expect(context.has(MemoryCategory.DECISIONS)).toBe(true);
      expect(context.has(MemoryCategory.CODING_STANDARDS)).toBe(true);
      expect(context.has(MemoryCategory.USER_PREFERENCES)).toBe(true);
      expect(context.has(MemoryCategory.FEATURE_HISTORY)).toBe(true);
      expect(context.has(MemoryCategory.BUSINESS_RULES)).toBe(true);
    });

    it('should only include categories that have entries', async () => {
      await memory.addDecision(projectId, 'Decision 1', 'Content', 'Reason');

      const context = await memory.getProjectContext(projectId);

      expect(context.has(MemoryCategory.DECISIONS)).toBe(true);
      expect(context.has(MemoryCategory.CODING_STANDARDS)).toBe(false);
      expect(context.has(MemoryCategory.USER_PREFERENCES)).toBe(false);
    });

    it('should return empty map for project with no entries', async () => {
      const context = await memory.getProjectContext('empty-project');
      expect(context.size).toBe(0);
    });

    it('should not include entries from other projects', async () => {
      await memory.addDecision(projectId, 'Decision 1', 'Content', 'Reason');
      await memory.addDecision('other-project', 'Decision 2', 'Content', 'Reason');

      const context = await memory.getProjectContext(projectId);
      const decisions = context.get(MemoryCategory.DECISIONS)!;

      expect(decisions.length).toBe(1);
      expect(decisions[0].title).toBe('Decision 1');
    });
  });

  describe('update and delete', () => {
    it('should update an existing entry', async () => {
      const entry = await memory.addDecision(projectId, 'Original', 'Content', 'Reason');

      const updated = await memory.update(entry.id, { title: 'Updated Title' });
      expect(updated).not.toBeNull();
      expect(updated!.title).toBe('Updated Title');
    });

    it('should delete an existing entry', async () => {
      const entry = await memory.addDecision(projectId, 'To Delete', 'Content', 'Reason');

      const deleted = await memory.delete(entry.id);
      expect(deleted).toBe(true);

      const retrieved = await memory.retrieve(entry.id);
      expect(retrieved).toBeNull();
    });
  });
});
