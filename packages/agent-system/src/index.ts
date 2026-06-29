// @builder/agent-system - Multi-Agent Orchestration System
//
// This package implements the multi-agent architecture for autonomous
// software engineering, with specialized agents for planning, coding,
// reviewing, testing, and deployment.

// ============================================================================
// Types
// ============================================================================

export {
  AgentRole,
  AgentState,
  TaskStatus,
  TaskPriority,
  MessageType,
  LoadBalancerStrategy,
  ProtocolMessageType,
} from './types/index.js';

export type {
  AgentTask,
  AgentMessage,
  AgentCapability,
  OrchestratorConfig,
  ExecutionPlan,
  ConflictInfo,
  MemoryEntry,
  TokenBudget,
  AgentOutput,
  GeneratedFile,
  WorkerPoolConfig,
  PoolStats,
} from './types/index.js';

// ============================================================================
// Agent Base
// ============================================================================

export { BaseAgent, type BaseAgentConfig } from './agent/base-agent.js';

// ============================================================================
// Manager Agent
// ============================================================================

export { ManagerAgent, type ManagerAgentConfig } from './agent/manager-agent.js';

// ============================================================================
// Specialized Agents
// ============================================================================

export {
  ArchitectAgent,
  FrontendAgent,
  BackendAgent,
  DatabaseAgent,
  SecurityAgent,
  TestingAgent,
} from './agent/specialized/index.js';

// ============================================================================
// Orchestrator
// ============================================================================

export { AgentOrchestrator, type TaskExecutionResult } from './orchestrator.js';

// ============================================================================
// Task Management
// ============================================================================

export { TaskDecomposer } from './task/task-decomposer.js';
export { TaskQueue } from './task/task-queue.js';

// ============================================================================
// Communication
// ============================================================================

export { EventBus, type EventHandler } from './communication/event-bus.js';
export {
  type TaskAssignmentPayload,
  type TaskResultPayload,
  type ConflictDetectedPayload,
  type ResolutionRequestPayload,
  type StatusUpdatePayload,
  type ContextSharePayload,
  createTaskAssignmentMessage,
  createTaskResultMessage,
  createStatusUpdateMessage,
  createContextShareMessage,
} from './communication/message-types.js';

// ============================================================================
// Memory
// ============================================================================

export { AgentMemory } from './memory/agent-memory.js';
export { ContextWindowManager } from './memory/context-window.js';

// ============================================================================
// Conflict Resolution
// ============================================================================

export { ConflictResolver, type ConflictCheck } from './conflict/resolver.js';
export {
  OutputMerger,
  type OutputMergerConfig,
  type MergeableFileOperation,
  type AgentFileOutput,
  type MergeResult,
  type MergeConflict,
  type MergeStrategy,
} from './conflict/output-merger.js';

// ============================================================================
// Worker Pool
// ============================================================================

export { WorkerPool } from './pool/index.js';
export { LoadBalancer } from './pool/index.js';

// ============================================================================
// Collaboration
// ============================================================================

export { SharedContext } from './collaboration/index.js';
export { AgentProtocol } from './collaboration/index.js';
