// ============================================================================
// BaseAgent - Abstract base class for all agents
// ============================================================================

import { type AIProvider, type AICompletionRequest, type AICompletionResponse } from '@builder/ai-core';

import { type EventBus } from '../communication/event-bus.js';
import { type AgentMemory } from '../memory/agent-memory.js';
import {
  type AgentTask,
  type AgentMessage,
  type AgentCapability,
  type MemoryEntry,
  AgentRole,
  AgentState,
  MessageType,
} from '../types/index.js';

export interface BaseAgentConfig {
  id: string;
  role: AgentRole;
  systemPrompt: string;
  capabilities: AgentCapability[];
  provider?: AIProvider;
  eventBus?: EventBus;
  memory?: AgentMemory;
  maxRetries?: number;
  model?: string;
}

/**
 * Abstract base class that all specialized agents extend.
 * Provides common behavior: state machine, message handling, AI provider integration.
 */
export abstract class BaseAgent {
  readonly id: string;
  readonly role: AgentRole;
  readonly capabilities: AgentCapability[];

  protected state: AgentState = AgentState.IDLE;
  protected systemPrompt: string;
  protected provider?: AIProvider;
  protected eventBus?: EventBus;
  protected memory?: AgentMemory;
  protected maxRetries: number;
  protected model: string;
  private unsubscribe?: () => void;

  constructor(config: BaseAgentConfig) {
    this.id = config.id;
    this.role = config.role;
    this.systemPrompt = config.systemPrompt;
    this.capabilities = config.capabilities;
    this.provider = config.provider;
    this.eventBus = config.eventBus;
    this.memory = config.memory;
    this.maxRetries = config.maxRetries ?? 3;
    this.model = config.model ?? 'gpt-4';
  }

  /**
   * Get the current state of the agent.
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * Transition to a new state.
   */
  protected setState(newState: AgentState): void {
    const previousState = this.state;
    this.state = newState;

    if (this.eventBus) {
      this.eventBus.publish({
        id: crypto.randomUUID(),
        from: this.id,
        to: 'orchestrator',
        type: MessageType.STATUS_UPDATE,
        payload: {
          agentId: this.id,
          previousState,
          currentState: newState,
        },
        timestamp: new Date(),
        correlationId: crypto.randomUUID(),
      });
    }
  }

  /**
   * Register this agent on the event bus to receive messages.
   */
  register(eventBus: EventBus): void {
    this.eventBus = eventBus;
    this.unsubscribe = eventBus.subscribeAgent(this.id, (message) => {
      void this.handleMessage(message);
    });
  }

  /**
   * Unregister from the event bus.
   */
  unregister(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  /**
   * Handle an incoming message.
   */
  async handleMessage(message: AgentMessage): Promise<void> {
    switch (message.type) {
      case MessageType.TASK_ASSIGNMENT: {
        const task = message.payload as unknown as { task: AgentTask };
        if (task.task) {
          await this.execute(task.task);
        }
        break;
      }
      case MessageType.CONTEXT_SHARE: {
        if (this.memory) {
          const payload = message.payload as { content: Record<string, unknown>; contextType: string };
          await this.memory.store({
            id: crypto.randomUUID(),
            agentId: this.id,
            type: 'shared',
            content: JSON.stringify(payload.content),
            metadata: { contextType: payload.contextType, from: message.from },
            timestamp: new Date(),
          });
        }
        break;
      }
      default:
        break;
    }
  }

  /**
   * Execute a task. Subclasses must implement this.
   */
  abstract execute(task: AgentTask): Promise<AgentTask>;

  /**
   * Check if this agent can handle the given task type.
   */
  abstract canHandle(taskType: string): boolean;

  /**
   * Call the AI provider with the given request.
   */
  protected async callAI(
    messages: { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }[],
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<AICompletionResponse> {
    if (!this.provider) {
      throw new Error(`Agent ${this.id} has no AI provider configured`);
    }

    const request: AICompletionRequest = {
      messages: [{ role: 'system', content: this.systemPrompt }, ...messages],
      model: this.model,
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 4096,
    };

    return this.provider.complete(request);
  }

  /**
   * Store a memory entry.
   */
  protected async storeMemory(
    content: string,
    type: MemoryEntry['type'],
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    if (this.memory) {
      await this.memory.store({
        id: crypto.randomUUID(),
        agentId: this.id,
        type,
        content,
        metadata,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Retrieve relevant memories.
   */
  protected async recallMemories(query: string, type?: MemoryEntry['type'], limit?: number): Promise<MemoryEntry[]> {
    if (!this.memory) return [];
    return this.memory.recall(this.id, query, type, limit);
  }
}
