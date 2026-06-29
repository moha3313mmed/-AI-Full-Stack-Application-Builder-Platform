// @builder/git - Conflict Resolver

import { ConflictInfo, ConflictType } from '../types/index.js';

export enum ResolutionStrategy {
  OURS = 'OURS',
  THEIRS = 'THEIRS',
  MANUAL = 'MANUAL',
}

export interface ConflictResolution {
  file: string;
  strategy: ResolutionStrategy;
  resolvedContent?: string;
}

export interface ResolutionResult {
  resolved: ConflictResolution[];
  unresolved: ConflictInfo[];
  hasConflicts: boolean;
}

/**
 * ConflictResolver detects and provides resolution strategies for merge conflicts.
 * Supports automatic resolution (ours/theirs) and manual resolution.
 */
export class ConflictResolver {
  private defaultStrategy: ResolutionStrategy = ResolutionStrategy.MANUAL;

  constructor(defaultStrategy?: ResolutionStrategy) {
    if (defaultStrategy) {
      this.defaultStrategy = defaultStrategy;
    }
  }

  /**
   * Detect conflicts between two versions of content.
   * Returns a list of conflict items found.
   */
  detectConflicts(
    baseFiles: Map<string, string>,
    oursFiles: Map<string, string>,
    theirsFiles: Map<string, string>,
  ): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    // Check all files in both ours and theirs
    const allFiles = new Set([...oursFiles.keys(), ...theirsFiles.keys()]);

    for (const file of allFiles) {
      const base = baseFiles.get(file);
      const ours = oursFiles.get(file);
      const theirs = theirsFiles.get(file);

      if (ours !== undefined && theirs !== undefined) {
        // Both modified the same file
        if (ours !== theirs && (ours !== base || theirs !== base)) {
          if (base === undefined) {
            // Both added same file with different content
            conflicts.push({
              file,
              type: ConflictType.ADD_ADD,
              ours,
              theirs,
            });
          } else if (ours !== base && theirs !== base) {
            // Both modified with different content
            conflicts.push({
              file,
              type: ConflictType.CONTENT,
              ours,
              theirs,
            });
          }
        }
      } else if (ours === undefined && theirs !== undefined && base !== undefined) {
        // We deleted, they modified
        conflicts.push({
          file,
          type: ConflictType.MODIFY_DELETE,
          ours: undefined,
          theirs,
        });
      } else if (theirs === undefined && ours !== undefined && base !== undefined) {
        // They deleted, we modified
        conflicts.push({
          file,
          type: ConflictType.MODIFY_DELETE,
          ours,
          theirs: undefined,
        });
      }
    }

    return conflicts;
  }

  /**
   * Resolve a list of conflicts using the specified or default strategy.
   */
  resolve(
    conflicts: ConflictInfo[],
    strategyOverrides?: Map<string, ResolutionStrategy>,
  ): ResolutionResult {
    const resolved: ConflictResolution[] = [];
    const unresolved: ConflictInfo[] = [];

    for (const conflict of conflicts) {
      const strategy = strategyOverrides?.get(conflict.file) || this.defaultStrategy;

      if (strategy === ResolutionStrategy.MANUAL) {
        unresolved.push(conflict);
        continue;
      }

      const resolution = this.resolveConflict(conflict, strategy);
      if (resolution) {
        resolved.push(resolution);
      } else {
        unresolved.push(conflict);
      }
    }

    return {
      resolved,
      unresolved,
      hasConflicts: unresolved.length > 0,
    };
  }

  /**
   * Resolve a single conflict using 'ours' strategy (keep our changes).
   */
  resolveOurs(conflict: ConflictInfo): ConflictResolution {
    return {
      file: conflict.file,
      strategy: ResolutionStrategy.OURS,
      resolvedContent: conflict.ours,
    };
  }

  /**
   * Resolve a single conflict using 'theirs' strategy (accept their changes).
   */
  resolveTheirs(conflict: ConflictInfo): ConflictResolution {
    return {
      file: conflict.file,
      strategy: ResolutionStrategy.THEIRS,
      resolvedContent: conflict.theirs,
    };
  }

  /**
   * Resolve a single conflict manually with custom content.
   */
  resolveManual(conflict: ConflictInfo, content: string): ConflictResolution {
    return {
      file: conflict.file,
      strategy: ResolutionStrategy.MANUAL,
      resolvedContent: content,
    };
  }

  /**
   * Get the default resolution strategy.
   */
  getDefaultStrategy(): ResolutionStrategy {
    return this.defaultStrategy;
  }

  /**
   * Set the default resolution strategy.
   */
  setDefaultStrategy(strategy: ResolutionStrategy): void {
    this.defaultStrategy = strategy;
  }

  /**
   * Check if a set of conflicts can be auto-resolved.
   * Conflicts can be auto-resolved if they all have 'ours' or 'theirs' strategy.
   */
  canAutoResolve(conflicts: ConflictInfo[]): boolean {
    // Only content conflicts with both sides present can be auto-resolved
    return conflicts.every(
      (c) => c.type === ConflictType.CONTENT && c.ours !== undefined && c.theirs !== undefined,
    );
  }

  private resolveConflict(
    conflict: ConflictInfo,
    strategy: ResolutionStrategy,
  ): ConflictResolution | null {
    switch (strategy) {
      case ResolutionStrategy.OURS:
        return {
          file: conflict.file,
          strategy: ResolutionStrategy.OURS,
          resolvedContent: conflict.ours,
        };
      case ResolutionStrategy.THEIRS:
        return {
          file: conflict.file,
          strategy: ResolutionStrategy.THEIRS,
          resolvedContent: conflict.theirs,
        };
      default:
        return null;
    }
  }
}
