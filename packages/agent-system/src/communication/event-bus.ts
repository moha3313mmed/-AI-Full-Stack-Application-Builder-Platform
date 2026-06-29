// ============================================================================
// Event Bus - In-process pub/sub for inter-agent communication
// ============================================================================

import { EventEmitter } from 'node:events';

import { type AgentMessage, MessageType } from '../types/index.js';

export type EventHandler = (message: AgentMessage) => void | Promise<void>;

export interface PendingReply {
  resolve: (message: AgentMessage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * EventBus provides typed publish/subscribe with message correlation
 * and request/reply patterns for inter-agent communication.
 */
export class EventBus {
  private emitter: EventEmitter;
  private pendingReplies: Map<string, PendingReply> = new Map();
  private subscriptions: Map<string, Set<EventHandler>> = new Map();
  private defaultReplyTimeout: number;

  constructor(options?: { maxListeners?: number; replyTimeout?: number }) {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(options?.maxListeners ?? 100);
    this.defaultReplyTimeout = options?.replyTimeout ?? 30000;
  }

  /**
   * Subscribe to messages of a specific type.
   */
  subscribe(type: MessageType, handler: EventHandler): () => void {
    const key = type;
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(handler);
    this.emitter.on(key, handler);

    // Return unsubscribe function
    return () => {
      this.subscriptions.get(key)?.delete(handler);
      this.emitter.off(key, handler);
    };
  }

  /**
   * Subscribe to messages directed at a specific agent.
   */
  subscribeAgent(agentId: string, handler: EventHandler): () => void {
    const key = `agent:${agentId}`;
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(handler);
    this.emitter.on(key, handler);

    return () => {
      this.subscriptions.get(key)?.delete(handler);
      this.emitter.off(key, handler);
    };
  }

  /**
   * Publish a message to all subscribers.
   */
  publish(message: AgentMessage): void {
    // Emit by message type
    this.emitter.emit(message.type, message);

    // Emit to target agent
    if (message.to) {
      this.emitter.emit(`agent:${message.to}`, message);
    }

    // Check for pending reply correlation
    if (message.type === MessageType.REPLY && message.correlationId) {
      const pending = this.pendingReplies.get(message.correlationId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingReplies.delete(message.correlationId);
        pending.resolve(message);
      }
    }
  }

  /**
   * Send a request and wait for a correlated reply.
   */
  request(message: AgentMessage, timeout?: number): Promise<AgentMessage> {
    const replyTimeout = timeout ?? this.defaultReplyTimeout;

    return new Promise<AgentMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingReplies.delete(message.correlationId);
        reject(new Error(`Request timed out after ${replyTimeout}ms for correlation ${message.correlationId}`));
      }, replyTimeout);

      this.pendingReplies.set(message.correlationId, { resolve, reject, timer });
      this.publish(message);
    });
  }

  /**
   * Get the number of subscribers for a given message type.
   */
  subscriberCount(type: MessageType): number {
    return this.subscriptions.get(type)?.size ?? 0;
  }

  /**
   * Remove all subscriptions and pending requests.
   */
  dispose(): void {
    for (const pending of this.pendingReplies.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('EventBus disposed'));
    }
    this.pendingReplies.clear();
    this.subscriptions.clear();
    this.emitter.removeAllListeners();
  }
}
