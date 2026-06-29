import { describe, it, expect, beforeEach } from 'vitest';

import { SnapshotManager } from '../vfs/snapshot.js';
import { VirtualFileSystem } from '../vfs/virtual-file-system.js';

describe('SnapshotManager', () => {
  let vfs: VirtualFileSystem;
  let snapshots: SnapshotManager;

  beforeEach(() => {
    vfs = new VirtualFileSystem('test-project');
    snapshots = new SnapshotManager();
  });

  describe('Create Snapshots', () => {
    it('should create a snapshot of the current state', () => {
      vfs.createFile('/src/index.ts', 'hello');
      const snapshot = snapshots.createSnapshot(vfs, 'initial');
      expect(snapshot.id).toBeDefined();
      expect(snapshot.label).toBe('initial');
      expect(snapshot.createdAt).toBeGreaterThan(0);
      expect(snapshot.nodes.size).toBeGreaterThan(0);
    });

    it('should create independent copies (not references)', () => {
      vfs.createFile('/src/index.ts', 'original');
      const snapshot = snapshots.createSnapshot(vfs);

      // Modify the VFS
      vfs.updateFile('/src/index.ts', 'modified');

      // Snapshot should still have original content
      const snapshotNode = snapshot.nodes.get('/src/index.ts');
      expect(snapshotNode?.content?.text).toBe('original');
    });
  });

  describe('Restore Snapshots', () => {
    it('should restore a snapshot', () => {
      vfs.createFile('/src/index.ts', 'original');
      const snapshot = snapshots.createSnapshot(vfs);

      // Modify VFS
      vfs.updateFile('/src/index.ts', 'modified');
      vfs.createFile('/src/new.ts', 'new file');

      // Restore
      snapshots.restoreSnapshot(snapshot.id, vfs);

      const restored = vfs.readFile('/src/index.ts');
      expect(restored.content?.text).toBe('original');
      expect(vfs.exists('/src/new.ts')).toBe(false);
    });

    it('should throw when restoring non-existent snapshot', () => {
      expect(() => snapshots.restoreSnapshot('fake-id', vfs)).toThrow('Snapshot not found');
    });

    it('should not mutate stored snapshot on restore', () => {
      vfs.createFile('/src/index.ts', 'original');
      const snapshot = snapshots.createSnapshot(vfs);

      // Restore and modify
      snapshots.restoreSnapshot(snapshot.id, vfs);
      vfs.updateFile('/src/index.ts', 'changed-after-restore');

      // Restore again should still have original
      snapshots.restoreSnapshot(snapshot.id, vfs);
      const node = vfs.readFile('/src/index.ts');
      expect(node.content?.text).toBe('original');
    });
  });

  describe('List Snapshots', () => {
    it('should list all snapshots sorted by time', () => {
      vfs.createFile('/a.ts', 'a');
      snapshots.createSnapshot(vfs, 'first');
      snapshots.createSnapshot(vfs, 'second');
      const list = snapshots.listSnapshots();
      expect(list).toHaveLength(2);
      expect(list[0].label).toBe('first');
      expect(list[1].label).toBe('second');
    });

    it('should return empty array when no snapshots', () => {
      expect(snapshots.listSnapshots()).toHaveLength(0);
    });
  });

  describe('Diff Snapshots', () => {
    it('should detect added files', () => {
      vfs.createFile('/a.ts', 'a');
      const s1 = snapshots.createSnapshot(vfs);

      vfs.createFile('/b.ts', 'b');
      const s2 = snapshots.createSnapshot(vfs);

      const diff = snapshots.diffSnapshots(s1.id, s2.id);
      expect(diff.added).toContain('/b.ts');
      expect(diff.removed).toHaveLength(0);
      expect(diff.modified).toHaveLength(0);
    });

    it('should detect removed files', () => {
      vfs.createFile('/a.ts', 'a');
      vfs.createFile('/b.ts', 'b');
      const s1 = snapshots.createSnapshot(vfs);

      vfs.deleteFile('/b.ts');
      const s2 = snapshots.createSnapshot(vfs);

      const diff = snapshots.diffSnapshots(s1.id, s2.id);
      expect(diff.removed).toContain('/b.ts');
      expect(diff.added).toHaveLength(0);
    });

    it('should detect modified files', () => {
      vfs.createFile('/a.ts', 'original');
      const s1 = snapshots.createSnapshot(vfs);

      vfs.updateFile('/a.ts', 'modified');
      const s2 = snapshots.createSnapshot(vfs);

      const diff = snapshots.diffSnapshots(s1.id, s2.id);
      expect(diff.modified).toContain('/a.ts');
    });

    it('should throw for non-existent snapshot IDs', () => {
      const s1 = snapshots.createSnapshot(vfs);
      expect(() => snapshots.diffSnapshots(s1.id, 'fake')).toThrow('Snapshot not found');
      expect(() => snapshots.diffSnapshots('fake', s1.id)).toThrow('Snapshot not found');
    });
  });

  describe('Delete and Clear', () => {
    it('should delete a specific snapshot', () => {
      const s1 = snapshots.createSnapshot(vfs);
      expect(snapshots.deleteSnapshot(s1.id)).toBe(true);
      expect(snapshots.listSnapshots()).toHaveLength(0);
    });

    it('should return false when deleting non-existent snapshot', () => {
      expect(snapshots.deleteSnapshot('fake')).toBe(false);
    });

    it('should clear all snapshots', () => {
      snapshots.createSnapshot(vfs);
      snapshots.createSnapshot(vfs);
      snapshots.clear();
      expect(snapshots.listSnapshots()).toHaveLength(0);
    });
  });
});
