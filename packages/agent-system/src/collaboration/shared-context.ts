// ============================================================================
// SharedContext - Shared knowledge base accessible to all agents in a session
// ============================================================================

import { type EventBus } from '../communication/event-bus.js';
import { MessageType } from '../types/index.js';

export interface SharedContextEntry {
  value: unknown;
  agentId: string;
  updatedAt: Date;
}

export type SharedContextSubscriber = (value: unknown, agentId: string) => void;

/**
 * SharedContext manages a shared knowledge base accessible to all agents
 * in a session. Supports subscriptions for change notifications and
 * optional EventBus integration for broadcast updates.
 */
export class SharedContext {
  private entries: Map<string, SharedContextEntry> = new Map();
  private subscribers: Map<string, Set<SharedContextSubscriber>> = new Map();
  private eventBus?: EventBus;

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Set a value in the shared context.
   */
  set(key: string, value: unknown, agentId: string): void {
    this.entries.set(key, {
      value,
      agentId,
      updatedAt: new Date(),
    });

    // Notify subscribers
    const keySubscribers = this.subscribers.get(key);
    if (keySubscribers) {
      for (const callback of keySubscribers) {
        callback(value, agentId);
      }
    }

    // Publish to event bus if available
    if (this.eventBus) {
      this.eventBus.publish({
        id: crypto.randomUUID(),
        from: agentId,
        to: '',
        type: MessageType.CONTEXT_SHARE,
        payload: { key, value: value as Record<string, unknown>, contextType: 'shared' },
        timestamp: new Date(),
        correlationId: crypto.randomUUID(),
      });
    }
  }

  /**
   * Get a value from the shared context.
   */
  get(key: string): SharedContextEntry | undefined {
    return this.entries.get(key);
  }

  /**
   * Get all entries in the shared context.
   */
  getAll(): Map<string, SharedContextEntry> {
    return new Map(this.entries);
  }

  /**
   * Subscribe to changes on a specific key.
   * Returns an unsubscribe function.
   */
  subscribe(key: string, callback: SharedContextSubscriber): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  /**
   * Get the list of unique agent IDs that have contributed to the context.
   */
  getContributors(): string[] {
    const contributors = new Set<string>();
    for (const entry of this.entries.values()) {
      contributors.add(entry.agentId);
    }
    return Array.from(contributors);
  }

  /**
   * Merge another SharedContext into this one.
   * Values from the other context overwrite existing values for the same key.
   */
  merge(other: SharedContext): void {
    const otherEntries = other.getAll();
    for (const [key, entry] of otherEntries) {
      this.entries.set(key, { ...entry });

      // Notify subscribers of merged values
      const keySubscribers = this.subscribers.get(key);
      if (keySubscribers) {
        for (const callback of keySubscribers) {
          callback(entry.value, entry.agentId);
        }
      }

      // Publish to event bus if available
      if (this.eventBus) {
        this.eventBus.publish({
          id: crypto.randomUUID(),
          from: entry.agentId,
          to: '',
          type: MessageType.CONTEXT_SHARE,
          payload: { key, value: entry.value as Record<string, unknown>, contextType: 'shared' },
          timestamp: new Date(),
          correlationId: crypto.randomUUID(),
        });
      }
    }
  }

  /**
   * Get the number of entries in the shared context.
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Clear all entries and subscribers.
   */
  clear(): void {
    this.entries.clear();
    this.subscribers.clear();
  }
}
