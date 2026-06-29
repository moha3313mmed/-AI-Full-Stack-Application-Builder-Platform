// ============================================================================
// OutputMerger - Merges file operations from multiple agent outputs
// ============================================================================

import { type ConflictInfo } from '../types/index.js';

/**
 * Represents a single file operation produced by an agent.
 */
export interface MergeableFileOperation {
  type: 'create' | 'update' | 'delete' | 'move' | 'rename';
  path: string;
  content?: string;
  language?: string;
  destination?: string;
  newName?: string;
}

/**
 * Output from a single agent containing file operations.
 */
export interface AgentFileOutput {
  agentId: string;
  taskId: string;
  operations: MergeableFileOperation[];
  explanation?: string;
}

/**
 * Result of merging multiple agent outputs.
 */
export interface MergeResult {
  /** Unified set of file operations ready to apply */
  operations: MergeableFileOperation[];
  /** Conflicts detected during merge */
  conflicts: MergeConflict[];
  /** Per-agent explanations combined */
  explanation: string;
  /** Whether all merges succeeded without conflict */
  clean: boolean;
}

/**
 * A conflict between two agents modifying the same file.
 */
export interface MergeConflict {
  path: string;
  agentIds: string[];
  taskIds: string[];
  /** Which agent's version was selected */
  resolvedFrom: string;
  /** The strategy used to resolve */
  strategy: 'last-writer-wins' | 'manual';
}

/**
 * Strategy for resolving file conflicts between agents.
 */
export type MergeStrategy = 'last-writer-wins';

export interface OutputMergerConfig {
  strategy?: MergeStrategy;
}

/**
 * OutputMerger takes structured outputs from multiple agents and produces
 * a unified set of file operations. It detects overlapping file paths and
 * resolves conflicts using the configured strategy.
 */
export class OutputMerger {
  private strategy: MergeStrategy;

  constructor(config?: OutputMergerConfig) {
    this.strategy = config?.strategy ?? 'last-writer-wins';
  }

  /**
   * Merge file operations from multiple agent outputs into a unified result.
   *
   * For non-conflicting files (different paths), operations are simply collected.
   * For conflicting files (same path modified by multiple agents), the configured
   * merge strategy is applied.
   */
  merge(outputs: AgentFileOutput[]): MergeResult {
    if (outputs.length === 0) {
      return { operations: [], conflicts: [], explanation: '', clean: true };
    }

    if (outputs.length === 1) {
      return {
        operations: [...outputs[0].operations],
        conflicts: [],
        explanation: outputs[0].explanation ?? '',
        clean: true,
      };
    }

    // Group operations by file path
    const operationsByPath = new Map<string, Array<{ agentId: string; taskId: string; operation: MergeableFileOperation }>>();

    for (const output of outputs) {
      for (const operation of output.operations) {
        const entries = operationsByPath.get(operation.path) ?? [];
        entries.push({ agentId: output.agentId, taskId: output.taskId, operation });
        operationsByPath.set(operation.path, entries);
      }
    }

    const mergedOperations: MergeableFileOperation[] = [];
    const conflicts: MergeConflict[] = [];

    for (const [path, entries] of operationsByPath) {
      if (entries.length === 1) {
        // No conflict - single agent modified this file
        mergedOperations.push(entries[0].operation);
      } else {
        // Conflict - multiple agents modified the same file
        const resolved = this.resolveConflict(path, entries);
        mergedOperations.push(resolved.operation);
        conflicts.push(resolved.conflict);
      }
    }

    // Combine explanations from all agents
    const explanations = outputs
      .map((o) => o.explanation)
      .filter((e): e is string => !!e);
    const explanation = explanations.join('\n\n');

    return {
      operations: mergedOperations,
      conflicts,
      explanation,
      clean: conflicts.length === 0,
    };
  }

  /**
   * Detect which file paths are modified by multiple agents without merging.
   */
  detectOverlaps(outputs: AgentFileOutput[]): Map<string, string[]> {
    const pathToAgents = new Map<string, string[]>();

    for (const output of outputs) {
      for (const operation of output.operations) {
        const agents = pathToAgents.get(operation.path) ?? [];
        if (!agents.includes(output.agentId)) {
          agents.push(output.agentId);
        }
        pathToAgents.set(operation.path, agents);
      }
    }

    // Return only paths with multiple agents
    const overlaps = new Map<string, string[]>();
    for (const [path, agents] of pathToAgents) {
      if (agents.length > 1) {
        overlaps.set(path, agents);
      }
    }
    return overlaps;
  }

  /**
   * Convert merge conflicts to ConflictInfo format for the ConflictResolver.
   */
  toConflictInfos(conflicts: MergeConflict[]): ConflictInfo[] {
    return conflicts.map((c) => ({
      id: crypto.randomUUID(),
      agentIds: c.agentIds,
      taskIds: c.taskIds,
      description: `File conflict on ${c.path}: resolved using ${c.strategy} (selected from ${c.resolvedFrom})`,
      conflictingOutputs: c.agentIds.map((id) => ({ agentId: id, path: c.path })),
      resolved: true,
      resolvedOutput: { strategy: c.strategy, selectedAgent: c.resolvedFrom },
    }));
  }

  /**
   * Resolve a conflict for a single file path using the configured strategy.
   */
  private resolveConflict(
    path: string,
    entries: Array<{ agentId: string; taskId: string; operation: MergeableFileOperation }>,
  ): { operation: MergeableFileOperation; conflict: MergeConflict } {
    // Last-writer-wins: the last agent in the array takes priority
    const winner = entries[entries.length - 1];

    return {
      operation: winner.operation,
      conflict: {
        path,
        agentIds: entries.map((e) => e.agentId),
        taskIds: entries.map((e) => e.taskId),
        resolvedFrom: winner.agentId,
        strategy: this.strategy,
      },
    };
  }
}
