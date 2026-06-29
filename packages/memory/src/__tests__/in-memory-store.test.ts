import { describe, it, expect, beforeEach } from 'vitest';

import { InMemoryStore } from '../store/in-memory-store.js';
import { MemoryCategory, type ProjectMemoryEntry } from '../types.js';

describe('InMemoryStore', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  function createEntry(overrides?: Partial<ProjectMemoryEntry>): ProjectMemoryEntry {
    return {
      id: crypto.randomUUID(),
      projectId: 'project-1',
      category: MemoryCategory.ARCHITECTURE,
      title: 'Test Entry',
      content: 'Test content for memory entry',
      tags: ['test'],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      ...overrides,
    };
  }

  describe('store and retrieve', () => {
    it('should store and retrieve an entry by ID', async () => {
      const entry = createEntry({ id: 'entry-1' });
      await store.store(entry);

      const result = await store.retrieve('entry-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('entry-1');
      expect(result!.title).toBe('Test Entry');
      expect(result!.content).toBe('Test content for memory entry');
    });

    it('should return null for non-existent entries', async () => {
      const result = await store.retrieve('non-existent');
      expect(result).toBeNull();
    });

    it('should store multiple entries', async () => {
      await store.store(createEntry({ id: 'entry-1' }));
      await store.store(createEntry({ id: 'entry-2' }));
      await store.store(createEntry({ id: 'entry-3' }));

      const result1 = await store.retrieve('entry-1');
      const result2 = await store.retrieve('entry-2');
      const result3 = await store.retrieve('entry-3');

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result3).not.toBeNull();
    });

    it('should return a copy of the entry (not a reference)', async () => {
      const entry = createEntry({ id: 'entry-1' });
      await store.store(entry);

      const result = await store.retrieve('entry-1');
      result!.title = 'Modified';

      const fresh = await store.retrieve('entry-1');
      expect(fresh!.title).toBe('Test Entry');
    });
  });

  describe('search by keywords', () => {
    it('should find entries matching search text', async () => {
      await store.store(
        createEntry({
          id: 'entry-1',
          title: 'React Component Architecture',
          content: 'Use functional components with hooks',
        }),
      );
      await store.store(
        createEntry({
          id: 'entry-2',
          title: 'Database Schema',
          content: 'PostgreSQL with Prisma ORM',
        }),
      );

      const results = await store.search({
        projectId: 'project-1',
        searchText: 'React hooks component',
      });

      expect(results.length).toBe(2);
      expect(results[0].entry.id).toBe('entry-1');
      expect(results[0].relevanceScore).toBeGreaterThan(results[1].relevanceScore);
    });

    it('should score title matches higher than content matches', async () => {
      await store.store(
        createEntry({
          id: 'entry-1',
          title: 'Authentication Flow',
          content: 'Uses JWT tokens for authentication',
        }),
      );
      await store.store(
        createEntry({
          id: 'entry-2',
          title: 'Simple Storage',
          content: 'Authentication details stored here',
        }),
      );

      const results = await store.search({
        projectId: 'project-1',
        searchText: 'authentication',
      });

      // entry-1 has "authentication" in both title and content
      expect(results[0].entry.id).toBe('entry-1');
      expect(results[0].relevanceScore).toBeGreaterThan(results[1].relevanceScore);
    });

    it('should score tag matches higher than content matches', async () => {
      await store.store(
        createEntry({
          id: 'entry-1',
          title: 'Entry One',
          content: 'No relevant content here',
          tags: ['security', 'auth'],
        }),
      );
      await store.store(
        createEntry({
          id: 'entry-2',
          title: 'Entry Two',
          content: 'This mentions security in passing',
          tags: ['general'],
        }),
      );

      const results = await store.search({
        projectId: 'project-1',
        searchText: 'security',
      });

      expect(results[0].entry.id).toBe('entry-1');
    });

    it('should return all entries with default score when no search text', async () => {
      await store.store(createEntry({ id: 'entry-1' }));
      await store.store(createEntry({ id: 'entry-2' }));

      const results = await store.search({ projectId: 'project-1' });

      expect(results.length).toBe(2);
      expect(results[0].relevanceScore).toBe(1);
      expect(results[1].relevanceScore).toBe(1);
    });

    it('should filter results by tags', async () => {
      await store.store(createEntry({ id: 'entry-1', tags: ['react', 'frontend'] }));
      await store.store(createEntry({ id: 'entry-2', tags: ['backend', 'api'] }));

      const results = await store.search({
        projectId: 'project-1',
        tags: ['react'],
      });

      expect(results.length).toBe(1);
      expect(results[0].entry.id).toBe('entry-1');
    });
  });

  describe('search by category', () => {
    it('should filter entries by category', async () => {
      await store.store(
        createEntry({ id: 'arch-1', category: MemoryCategory.ARCHITECTURE }),
      );
      await store.store(
        createEntry({ id: 'std-1', category: MemoryCategory.CODING_STANDARDS }),
      );
      await store.store(
        createEntry({ id: 'arch-2', category: MemoryCategory.ARCHITECTURE }),
      );

      const results = await store.search({
        projectId: 'project-1',
        categories: [MemoryCategory.ARCHITECTURE],
      });

      expect(results.length).toBe(2);
      expect(results.every((r) => r.entry.category === MemoryCategory.ARCHITECTURE)).toBe(true);
    });

    it('should support multiple categories in search', async () => {
      await store.store(
        createEntry({ id: 'arch-1', category: MemoryCategory.ARCHITECTURE }),
      );
      await store.store(
        createEntry({ id: 'std-1', category: MemoryCategory.CODING_STANDARDS }),
      );
      await store.store(
        createEntry({ id: 'pref-1', category: MemoryCategory.USER_PREFERENCES }),
      );

      const results = await store.search({
        projectId: 'project-1',
        categories: [MemoryCategory.ARCHITECTURE, MemoryCategory.CODING_STANDARDS],
      });

      expect(results.length).toBe(2);
    });

    it('should get entries by category using getByCategory', async () => {
      await store.store(
        createEntry({ id: 'arch-1', category: MemoryCategory.ARCHITECTURE }),
      );
      await store.store(
        createEntry({ id: 'std-1', category: MemoryCategory.CODING_STANDARDS }),
      );

      const archEntries = await store.getByCategory('project-1', MemoryCategory.ARCHITECTURE);
      expect(archEntries.length).toBe(1);
      expect(archEntries[0].id).toBe('arch-1');
    });
  });

  describe('update entries', () => {
    it('should update an existing entry', async () => {
      await store.store(createEntry({ id: 'entry-1', title: 'Original Title' }));

      const updated = await store.update('entry-1', { title: 'Updated Title' });

      expect(updated).not.toBeNull();
      expect(updated!.title).toBe('Updated Title');
      expect(updated!.version).toBe(2);
    });

    it('should return null when updating non-existent entry', async () => {
      const result = await store.update('non-existent', { title: 'New Title' });
      expect(result).toBeNull();
    });

    it('should increment version on update', async () => {
      await store.store(createEntry({ id: 'entry-1', version: 1 }));

      await store.update('entry-1', { content: 'Updated content' });
      const result = await store.retrieve('entry-1');
      expect(result!.version).toBe(2);
    });

    it('should update the updatedAt timestamp', async () => {
      const originalDate = new Date('2024-01-01');
      await store.store(createEntry({ id: 'entry-1', updatedAt: originalDate }));

      await store.update('entry-1', { content: 'Updated' });
      const result = await store.retrieve('entry-1');
      expect(result!.updatedAt.getTime()).toBeGreaterThan(originalDate.getTime());
    });

    it('should not allow ID to be changed via update', async () => {
      await store.store(createEntry({ id: 'entry-1' }));

      await store.update('entry-1', { id: 'changed-id' } as Partial<ProjectMemoryEntry>);
      const result = await store.retrieve('entry-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('entry-1');
    });
  });

  describe('delete entries', () => {
    it('should delete an existing entry', async () => {
      await store.store(createEntry({ id: 'entry-1' }));

      const deleted = await store.delete('entry-1');
      expect(deleted).toBe(true);

      const result = await store.retrieve('entry-1');
      expect(result).toBeNull();
    });

    it('should return false when deleting non-existent entry', async () => {
      const deleted = await store.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('list by project', () => {
    it('should list entries for a specific project', async () => {
      await store.store(createEntry({ id: 'p1-1', projectId: 'project-1' }));
      await store.store(createEntry({ id: 'p1-2', projectId: 'project-1' }));
      await store.store(createEntry({ id: 'p2-1', projectId: 'project-2' }));

      const results = await store.listByProject('project-1');
      expect(results.length).toBe(2);
      expect(results.every((e) => e.projectId === 'project-1')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await store.store(createEntry({ id: `entry-${i}` }));
      }

      const results = await store.listByProject('project-1', { limit: 3 });
      expect(results.length).toBe(3);
    });

    it('should respect offset parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await store.store(
          createEntry({
            id: `entry-${i}`,
            updatedAt: new Date(2024, 0, i + 1),
          }),
        );
      }

      const allResults = await store.listByProject('project-1');
      const offsetResults = await store.listByProject('project-1', { offset: 2 });

      expect(offsetResults.length).toBe(3);
      expect(offsetResults[0].id).toBe(allResults[2].id);
    });

    it('should return empty array for project with no entries', async () => {
      const results = await store.listByProject('empty-project');
      expect(results).toEqual([]);
    });

    it('should order by updatedAt descending', async () => {
      await store.store(
        createEntry({ id: 'old', updatedAt: new Date('2024-01-01') }),
      );
      await store.store(
        createEntry({ id: 'new', updatedAt: new Date('2024-06-01') }),
      );
      await store.store(
        createEntry({ id: 'mid', updatedAt: new Date('2024-03-01') }),
      );

      const results = await store.listByProject('project-1');
      expect(results[0].id).toBe('new');
      expect(results[1].id).toBe('mid');
      expect(results[2].id).toBe('old');
    });
  });
});
