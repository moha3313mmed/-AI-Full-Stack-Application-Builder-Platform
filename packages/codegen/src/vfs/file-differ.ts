import type { FileChange, FileOperationType } from './types.js';

// ============================================================================
// File Differ - Tracks file changes with before/after content
// ============================================================================

/**
 * Tracks file changes over time, maintaining an ordered log
 * that can be used to generate patches or review history.
 */
export class FileDiffer {
  private changes: FileChange[] = [];

  /**
   * Track a file change with before and after content.
   */
  trackChange(
    path: string,
    type: FileOperationType,
    before: string | null,
    after: string | null
  ): FileChange {
    const change: FileChange = {
      path,
      type,
      before,
      after,
      timestamp: Date.now(),
    };

    this.changes.push(change);
    return change;
  }

  /**
   * Get all changes, optionally filtered by timestamp.
   */
  getChanges(since?: number): FileChange[] {
    if (since === undefined) {
      return [...this.changes];
    }
    return this.changes.filter((change) => change.timestamp >= since);
  }

  /**
   * Get changes for a specific file path.
   */
  getChangesForFile(path: string): FileChange[] {
    return this.changes.filter((change) => change.path === path);
  }

  /**
   * Generate a patch object representing all changes since a timestamp.
   */
  generatePatch(since?: number): PatchData {
    const changes = this.getChanges(since);
    return {
      changes: changes.map((c) => ({
        path: c.path,
        type: c.type,
        before: c.before,
        after: c.after,
        timestamp: c.timestamp,
      })),
      generatedAt: Date.now(),
    };
  }

  /**
   * Apply a patch to produce a set of file operations.
   * Returns the final state of each affected file.
   */
  applyPatch(patch: PatchData): Map<string, string | null> {
    const result = new Map<string, string | null>();

    for (const change of patch.changes) {
      if (change.type === 'delete') {
        result.set(change.path, null);
      } else {
        result.set(change.path, change.after);
      }
    }

    return result;
  }

  /**
   * Clear all tracked changes.
   */
  clear(): void {
    this.changes = [];
  }

  /**
   * Get the total number of tracked changes.
   */
  get length(): number {
    return this.changes.length;
  }
}

/**
 * Serializable patch data representing a set of file changes.
 */
export interface PatchData {
  changes: Array<{
    path: string;
    type: FileOperationType;
    before: string | null;
    after: string | null;
    timestamp: number;
  }>;
  generatedAt: number;
}
