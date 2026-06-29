// ============================================================================
// ConflictResolver - Detects and mediates conflicting agent outputs
// ============================================================================

import { type EventBus } from '../communication/event-bus.js';
import { type ConflictInfo, type AgentMessage, MessageType } from '../types/index.js';

export interface ConflictCheck {
  taskId: string;
  agentId: string;
  output: Record<string, unknown>;
  outputType: string;
}

/**
 * ConflictResolver detects when agents produce conflicting outputs
 * and mediates resolution through the Manager Agent.
 */
export class ConflictResolver {
  private pendingOutputs: Map<string, ConflictCheck[]> = new Map();
  private conflicts: Map<string, ConflictInfo> = new Map();
  private eventBus?: EventBus;
  private conflictDetectors: Array<(outputs: ConflictCheck[]) => ConflictInfo | null> = [];

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus;
    this.registerDefaultDetectors();
  }

  /**
   * Register a completed task output for conflict checking.
   */
  registerOutput(check: ConflictCheck, groupKey?: string): ConflictInfo | null {
    const key = groupKey ?? check.outputType;
    const existing = this.pendingOutputs.get(key) ?? [];
    existing.push(check);
    this.pendingOutputs.set(key, existing);

    // Check for conflicts when we have multiple outputs of the same type
    if (existing.length >= 2) {
      return this.detectConflicts(key, existing);
    }
    return null;
  }

  /**
   * Run conflict detection on a set of outputs.
   */
  private detectConflicts(_key: string, outputs: ConflictCheck[]): ConflictInfo | null {
    for (const detector of this.conflictDetectors) {
      const conflict = detector(outputs);
      if (conflict) {
        this.conflicts.set(conflict.id, conflict);
        this.notifyConflict(conflict);
        return conflict;
      }
    }
    return null;
  }

  /**
   * Register default conflict detection strategies.
   */
  private registerDefaultDetectors(): void {
    // Detect API contract mismatches (frontend vs backend)
    this.conflictDetectors.push((outputs) => {
      const apiOutputs = outputs.filter(
        (o) => o.outputType === 'api_contract' || o.outputType === 'api_implementation',
      );
      if (apiOutputs.length < 2) return null;

      // Check for structural differences in API outputs
      const endpoints = new Set<string>();
      const conflicting: ConflictCheck[] = [];

      for (const output of apiOutputs) {
        const outputEndpoints = this.extractEndpoints(output.output);
        for (const ep of outputEndpoints) {
          if (endpoints.has(ep)) {
            conflicting.push(output);
          }
          endpoints.add(ep);
        }
      }

      if (conflicting.length > 0) {
        return {
          id: crypto.randomUUID(),
          agentIds: conflicting.map((c) => c.agentId),
          taskIds: conflicting.map((c) => c.taskId),
          description: 'API contract mismatch detected between agents',
          conflictingOutputs: conflicting.map((c) => c.output),
          resolved: false,
        };
      }
      return null;
    });

    // Detect schema conflicts (different agents defining the same entity differently)
    this.conflictDetectors.push((outputs) => {
      const schemaOutputs = outputs.filter(
        (o) => o.outputType === 'schema' || o.outputType === 'data_model',
      );
      if (schemaOutputs.length < 2) return null;

      // Check for conflicting field definitions
      const schemas = schemaOutputs.map((o) => ({
        ...o,
        fields: this.extractFields(o.output),
      }));

      for (let i = 0; i < schemas.length; i++) {
        for (let j = i + 1; j < schemas.length; j++) {
          const conflicts = this.findFieldConflicts(schemas[i].fields, schemas[j].fields);
          if (conflicts.length > 0) {
            return {
              id: crypto.randomUUID(),
              agentIds: [schemas[i].agentId, schemas[j].agentId],
              taskIds: [schemas[i].taskId, schemas[j].taskId],
              description: `Schema conflict: conflicting field definitions for ${conflicts.join(', ')}`,
              conflictingOutputs: [schemas[i].output, schemas[j].output],
              resolved: false,
            };
          }
        }
      }
      return null;
    });
  }

  /**
   * Add a custom conflict detector.
   */
  addDetector(detector: (outputs: ConflictCheck[]) => ConflictInfo | null): void {
    this.conflictDetectors.push(detector);
  }

  /**
   * Mark a conflict as resolved.
   */
  resolve(conflictId: string, resolution: Record<string, unknown>): boolean {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return false;

    conflict.resolved = true;
    conflict.resolvedOutput = resolution;
    return true;
  }

  /**
   * Get all unresolved conflicts.
   */
  getUnresolved(): ConflictInfo[] {
    return Array.from(this.conflicts.values()).filter((c) => !c.resolved);
  }

  /**
   * Get a specific conflict by ID.
   */
  getConflict(conflictId: string): ConflictInfo | undefined {
    return this.conflicts.get(conflictId);
  }

  /**
   * Clear outputs for a group (after resolution).
   */
  clearGroup(groupKey: string): void {
    this.pendingOutputs.delete(groupKey);
  }

  /**
   * Notify via event bus about a detected conflict.
   */
  private notifyConflict(conflict: ConflictInfo): void {
    if (this.eventBus) {
      const message: AgentMessage = {
        id: crypto.randomUUID(),
        from: 'conflict-resolver',
        to: 'manager',
        type: MessageType.CONFLICT_DETECTED,
        payload: conflict as unknown as Record<string, unknown>,
        timestamp: new Date(),
        correlationId: conflict.id,
      };
      this.eventBus.publish(message);
    }
  }

  /**
   * Extract endpoint definitions from an output (simple heuristic).
   */
  private extractEndpoints(output: Record<string, unknown>): string[] {
    const endpoints: string[] = [];
    const content = JSON.stringify(output);
    const matches = content.match(/(GET|POST|PUT|DELETE|PATCH)\s+\/[\w/{}:-]+/g);
    if (matches) {
      endpoints.push(...matches);
    }
    return endpoints;
  }

  /**
   * Extract field names from a schema output.
   */
  private extractFields(output: Record<string, unknown>): Map<string, string> {
    const fields = new Map<string, string>();
    if (output && typeof output === 'object') {
      const content = JSON.stringify(output);
      // Simple heuristic: look for field:type patterns
      const matches = content.match(/"(\w+)":\s*"(string|number|boolean|object|array)"/g);
      if (matches) {
        for (const match of matches) {
          const parts = match.match(/"(\w+)":\s*"(\w+)"/);
          if (parts) {
            fields.set(parts[1], parts[2]);
          }
        }
      }
    }
    return fields;
  }

  /**
   * Find conflicting field definitions between two schemas.
   */
  private findFieldConflicts(fields1: Map<string, string>, fields2: Map<string, string>): string[] {
    const conflicts: string[] = [];
    for (const [name, type] of fields1) {
      const otherType = fields2.get(name);
      if (otherType && otherType !== type) {
        conflicts.push(name);
      }
    }
    return conflicts;
  }
}
