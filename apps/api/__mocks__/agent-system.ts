export class EventBus {
  subscribe() { return () => {}; }
  publish() {}
  dispose() {}
}

export class BaseAgent {}
export class ManagerAgent {}
export class FrontendAgent {}
export class BackendAgent {}
export class AgentOrchestrator {}
export class TaskDecomposer {}
export class TaskQueue {}
export class AgentMemory {}
export class ContextWindowManager {}
export class ConflictResolver {}

export const AgentRole = {};
export const AgentState = {};
export const TaskStatus = {};
export const TaskPriority = {};
export const MessageType = {};
