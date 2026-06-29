// ============================================================================
// Inter-Agent Message Type Definitions
// ============================================================================

import { type AgentTask, type AgentMessage, MessageType } from '../types/index.js';

/**
 * Message payload for assigning a task to an agent.
 */
export interface TaskAssignmentPayload {
  task: AgentTask;
  context?: Record<string, unknown>;
  deadline?: Date;
}

/**
 * Message payload for reporting a task result.
 */
export interface TaskResultPayload {
  taskId: string;
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  metrics?: {
    duration: number;
    tokensUsed: number;
  };
}

/**
 * Message payload for conflict detection.
 */
export interface ConflictDetectedPayload {
  conflictId: string;
  agentIds: string[];
  taskIds: string[];
  description: string;
  conflictingOutputs: Record<string, unknown>[];
}

/**
 * Message payload for requesting conflict resolution.
 */
export interface ResolutionRequestPayload {
  conflictId: string;
  suggestedResolution?: Record<string, unknown>;
  priority: number;
}

/**
 * Message payload for status updates.
 */
export interface StatusUpdatePayload {
  agentId: string;
  previousState: string;
  currentState: string;
  taskId?: string;
  progress?: number;
  message?: string;
}

/**
 * Message payload for sharing context between agents.
 */
export interface ContextSharePayload {
  sourceAgentId: string;
  contextType: string;
  content: Record<string, unknown>;
  relevantTaskIds?: string[];
}

/**
 * Type-safe message factory functions.
 */
export function createTaskAssignmentMessage(
  from: string,
  to: string,
  payload: TaskAssignmentPayload,
  correlationId: string,
): AgentMessage {
  return {
    id: crypto.randomUUID(),
    from,
    to,
    type: MessageType.TASK_ASSIGNMENT,
    payload: payload as unknown as Record<string, unknown>,
    timestamp: new Date(),
    correlationId,
  };
}

export function createTaskResultMessage(
  from: string,
  to: string,
  payload: TaskResultPayload,
  correlationId: string,
): AgentMessage {
  return {
    id: crypto.randomUUID(),
    from,
    to,
    type: MessageType.TASK_RESULT,
    payload: payload as unknown as Record<string, unknown>,
    timestamp: new Date(),
    correlationId,
  };
}

export function createStatusUpdateMessage(
  from: string,
  to: string,
  payload: StatusUpdatePayload,
  correlationId: string,
): AgentMessage {
  return {
    id: crypto.randomUUID(),
    from,
    to,
    type: MessageType.STATUS_UPDATE,
    payload: payload as unknown as Record<string, unknown>,
    timestamp: new Date(),
    correlationId,
  };
}

export function createContextShareMessage(
  from: string,
  to: string,
  payload: ContextSharePayload,
  correlationId: string,
): AgentMessage {
  return {
    id: crypto.randomUUID(),
    from,
    to,
    type: MessageType.CONTEXT_SHARE,
    payload: payload as unknown as Record<string, unknown>,
    timestamp: new Date(),
    correlationId,
  };
}
