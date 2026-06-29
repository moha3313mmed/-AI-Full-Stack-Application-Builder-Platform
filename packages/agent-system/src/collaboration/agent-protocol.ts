// ============================================================================
// AgentProtocol - Structured message formats for inter-agent communication
// ============================================================================

import { type AgentMessage, type AgentTask, MessageType, ProtocolMessageType } from '../types/index.js';

/**
 * AgentProtocol provides static factory methods for creating structured
 * inter-agent protocol messages. Each message follows a defined schema
 * with typed payloads for specific collaboration patterns.
 */
export class AgentProtocol {
  /**
   * Create a review request message.
   * One agent asks another to review its output.
   */
  static createReviewRequest(
    fromAgent: string,
    toAgent: string,
    output: Record<string, unknown>,
    context: Record<string, unknown>,
  ): AgentMessage {
    return {
      id: crypto.randomUUID(),
      from: fromAgent,
      to: toAgent,
      type: MessageType.REQUEST,
      payload: {
        protocolType: ProtocolMessageType.REVIEW_REQUEST,
        output,
        context,
      },
      timestamp: new Date(),
      correlationId: crypto.randomUUID(),
    };
  }

  /**
   * Create a context provision message.
   * An agent shares relevant context with another agent.
   */
  static createContextProvision(
    fromAgent: string,
    toAgent: string,
    contextData: Record<string, unknown>,
  ): AgentMessage {
    return {
      id: crypto.randomUUID(),
      from: fromAgent,
      to: toAgent,
      type: MessageType.CONTEXT_SHARE,
      payload: {
        protocolType: ProtocolMessageType.CONTEXT_PROVISION,
        contextData,
      },
      timestamp: new Date(),
      correlationId: crypto.randomUUID(),
    };
  }

  /**
   * Create a clarification request message.
   * An agent requests more information from another agent.
   */
  static createClarificationRequest(
    fromAgent: string,
    toAgent: string,
    question: string,
    context: Record<string, unknown>,
  ): AgentMessage {
    return {
      id: crypto.randomUUID(),
      from: fromAgent,
      to: toAgent,
      type: MessageType.REQUEST,
      payload: {
        protocolType: ProtocolMessageType.CLARIFICATION_REQUEST,
        question,
        context,
      },
      timestamp: new Date(),
      correlationId: crypto.randomUUID(),
    };
  }

  /**
   * Create a subtask delegation message.
   * An agent delegates a subtask to another agent.
   */
  static createSubtaskDelegation(
    fromAgent: string,
    toAgent: string,
    task: AgentTask,
    constraints: Record<string, unknown>,
  ): AgentMessage {
    return {
      id: crypto.randomUUID(),
      from: fromAgent,
      to: toAgent,
      type: MessageType.TASK_ASSIGNMENT,
      payload: {
        protocolType: ProtocolMessageType.SUBTASK_DELEGATION,
        task,
        constraints,
      },
      timestamp: new Date(),
      correlationId: crypto.randomUUID(),
    };
  }
}
