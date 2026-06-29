import { randomUUID } from 'node:crypto';

import type { VFSNode, VFSSnapshot } from './types.js';
import type { VirtualFileSystem } from './virtual-file-system.js';

// ============================================================================
// Snapshot Manager - Point-in-time captures of the VFS state
// ============================================================================

/**
 * Manages snapshots of the virtual file system.
 * Snapshots are full copies of the file tree serialized for later restoration.
 */
export class SnapshotManager {
  private snapshots: Map<string, VFSSnapshot> = new Map();

  /**
   * Create a snapshot of the current file tree state.
   */
  createSnapshot(vfs: VirtualFileSystem, label?: string): VFSSnapshot {
    const id = randomUUID();
    const nodes = vfs.getAllNodes();
    const metadata = vfs.getTree();

    // Deep clone nodes to prevent reference sharing
    const clonedNodes = new Map<string, VFSNode>();
    for (const [path, node] of nodes) {
      clonedNodes.set(path, this.deepCloneNode(node));
    }

    const snapshot: VFSSnapshot = {
      id,
      label,
      createdAt: Date.now(),
      nodes: clonedNodes,
      metadata: { ...metadata },
    };

    this.snapshots.set(id, snapshot);
    return snapshot;
  }

  /**
   * Restore a snapshot, replacing the current VFS state.
   */
  restoreSnapshot(id: string, vfs: VirtualFileSystem): void {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${id}`);
    }

    // Deep clone to prevent mutation of stored snapshot
    const clonedNodes = new Map<string, VFSNode>();
    for (const [path, node] of snapshot.nodes) {
      clonedNodes.set(path, this.deepCloneNode(node));
    }

    vfs.restoreFromNodes(clonedNodes, { ...snapshot.metadata });
  }

  /**
   * List all available snapshots.
   */
  listSnapshots(): VFSSnapshot[] {
    return Array.from(this.snapshots.values()).sort(
      (a, b) => a.createdAt - b.createdAt
    );
  }

  /**
   * Get a specific snapshot by ID.
   */
  getSnapshot(id: string): VFSSnapshot | undefined {
    return this.snapshots.get(id);
  }

  /**
   * Compare two snapshots and return the differences.
   */
  diffSnapshots(
    id1: string,
    id2: string
  ): SnapshotDiff {
    const snapshot1 = this.snapshots.get(id1);
    const snapshot2 = this.snapshots.get(id2);

    if (!snapshot1) {
      throw new Error(`Snapshot not found: ${id1}`);
    }
    if (!snapshot2) {
      throw new Error(`Snapshot not found: ${id2}`);
    }

    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];

    // Find added and modified files
    for (const [path, node2] of snapshot2.nodes) {
      if (node2.type !== 'file') continue;
      const node1 = snapshot1.nodes.get(path);
      if (!node1) {
        added.push(path);
      } else if (node1.type === 'file' && node1.content?.text !== node2.content?.text) {
        modified.push(path);
      }
    }

    // Find removed files
    for (const [path, node1] of snapshot1.nodes) {
      if (node1.type !== 'file') continue;
      if (!snapshot2.nodes.has(path)) {
        removed.push(path);
      }
    }

    return { added, removed, modified };
  }

  /**
   * Delete a snapshot.
   */
  deleteSnapshot(id: string): boolean {
    return this.snapshots.delete(id);
  }

  /**
   * Clear all snapshots.
   */
  clear(): void {
    this.snapshots.clear();
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private deepCloneNode(node: VFSNode): VFSNode {
    return {
      ...node,
      content: node.content ? { ...node.content } : undefined,
      children: node.children ? [...node.children] : undefined,
    };
  }
}

/**
 * Result of comparing two snapshots.
 */
export interface SnapshotDiff {
  /** Files present in snapshot2 but not in snapshot1 */
  added: string[];
  /** Files present in snapshot1 but not in snapshot2 */
  removed: string[];
  /** Files present in both but with different content */
  modified: string[];
}
