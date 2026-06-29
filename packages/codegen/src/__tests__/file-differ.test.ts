import { describe, it, expect, beforeEach } from 'vitest';

import { FileDiffer } from '../vfs/file-differ.js';

describe('FileDiffer', () => {
  let differ: FileDiffer;

  beforeEach(() => {
    differ = new FileDiffer();
  });

  describe('Track Changes', () => {
    it('should track a file creation', () => {
      const change = differ.trackChange('/src/index.ts', 'create', null, 'new content');
      expect(change.path).toBe('/src/index.ts');
      expect(change.type).toBe('create');
      expect(change.before).toBeNull();
      expect(change.after).toBe('new content');
      expect(change.timestamp).toBeGreaterThan(0);
    });

    it('should track a file update', () => {
      const change = differ.trackChange('/src/index.ts', 'update', 'old', 'new');
      expect(change.type).toBe('update');
      expect(change.before).toBe('old');
      expect(change.after).toBe('new');
    });

    it('should track a file deletion', () => {
      const change = differ.trackChange('/src/index.ts', 'delete', 'content', null);
      expect(change.type).toBe('delete');
      expect(change.before).toBe('content');
      expect(change.after).toBeNull();
    });

    it('should maintain change count', () => {
      differ.trackChange('/a.ts', 'create', null, 'a');
      differ.trackChange('/b.ts', 'create', null, 'b');
      expect(differ.length).toBe(2);
    });
  });

  describe('Get Changes', () => {
    it('should return all changes when no filter', () => {
      differ.trackChange('/a.ts', 'create', null, 'a');
      differ.trackChange('/b.ts', 'create', null, 'b');
      const changes = differ.getChanges();
      expect(changes).toHaveLength(2);
    });

    it('should filter changes by timestamp', async () => {
      differ.trackChange('/a.ts', 'create', null, 'a');
      // Small delay to ensure different timestamps
      const since = Date.now() + 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      differ.trackChange('/b.ts', 'create', null, 'b');
      const changes = differ.getChanges(since);
      expect(changes).toHaveLength(1);
      expect(changes[0].path).toBe('/b.ts');
    });

    it('should get changes for a specific file', () => {
      differ.trackChange('/a.ts', 'create', null, 'v1');
      differ.trackChange('/b.ts', 'create', null, 'b');
      differ.trackChange('/a.ts', 'update', 'v1', 'v2');
      const changes = differ.getChangesForFile('/a.ts');
      expect(changes).toHaveLength(2);
    });
  });

  describe('Patch Generation', () => {
    it('should generate a patch from changes', () => {
      differ.trackChange('/a.ts', 'create', null, 'content-a');
      differ.trackChange('/b.ts', 'update', 'old-b', 'new-b');
      const patch = differ.generatePatch();
      expect(patch.changes).toHaveLength(2);
      expect(patch.generatedAt).toBeGreaterThan(0);
    });

    it('should generate a patch filtered by timestamp', async () => {
      differ.trackChange('/a.ts', 'create', null, 'a');
      const since = Date.now() + 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      differ.trackChange('/b.ts', 'create', null, 'b');
      const patch = differ.generatePatch(since);
      expect(patch.changes).toHaveLength(1);
    });
  });

  describe('Patch Application', () => {
    it('should apply a patch to get final file states', () => {
      differ.trackChange('/a.ts', 'create', null, 'content-a');
      differ.trackChange('/b.ts', 'delete', 'old-b', null);
      const patch = differ.generatePatch();
      const result = differ.applyPatch(patch);
      expect(result.get('/a.ts')).toBe('content-a');
      expect(result.get('/b.ts')).toBeNull();
    });

    it('should use last change for multiply-modified files', () => {
      differ.trackChange('/a.ts', 'create', null, 'v1');
      differ.trackChange('/a.ts', 'update', 'v1', 'v2');
      const patch = differ.generatePatch();
      const result = differ.applyPatch(patch);
      expect(result.get('/a.ts')).toBe('v2');
    });
  });

  describe('Clear', () => {
    it('should clear all changes', () => {
      differ.trackChange('/a.ts', 'create', null, 'a');
      differ.clear();
      expect(differ.length).toBe(0);
      expect(differ.getChanges()).toHaveLength(0);
    });
  });
});
