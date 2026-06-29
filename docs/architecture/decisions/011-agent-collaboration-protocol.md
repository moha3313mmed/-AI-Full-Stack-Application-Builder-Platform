# ADR 011: Agent Collaboration Protocol

## Status

Accepted

## Context

Agents need to collaborate beyond simple task assignment. The existing system supports one-way task dispatch from the orchestrator to individual agents, but lacks mechanisms for agents to share context with each other, request reviews, delegate subtasks, or ask for clarification. More sophisticated AI workflows require real-time knowledge sharing and structured inter-agent communication.

Requirements include:

- Session-level shared state accessible to all agents working on the same project
- Subscription-based change notifications so agents can react to context updates
- Structured message types for common collaboration patterns
- Built on existing infrastructure (EventBus) rather than introducing new communication layers
- Extensible protocol for future message types

Options considered:
- **Shared database state**: Agents read/write to a shared database, poll for changes
- **Message queue (RabbitMQ, Kafka)**: Full pub/sub infrastructure, heavy for in-process agents
- **In-memory shared context with EventBus notifications**: Lightweight, real-time, leverages existing infrastructure
- **Direct agent-to-agent RPC**: Tight coupling between agent implementations

## Decision

We will implement `SharedContext` and `AgentProtocol` in the `@builder/agent-system` package (`packages/agent-system/src/collaboration/`). SharedContext provides session-level key-value storage with subscription notifications, while AgentProtocol defines structured message schemas for inter-agent communication patterns.

### Core Components

1. **`SharedContext`** (`src/collaboration/shared-context.ts`): A session-level key-value store accessible to all agents. Each entry tracks the value, contributing agent ID, and update timestamp. Features:
   - `set(key, value, agentId)`: Store a value with attribution
   - `get(key)`: Retrieve a context entry
   - `getAll()`: Get the complete context map
   - `subscribe(key, callback)`: Register for change notifications on a specific key, returns an unsubscribe function
   - `getContributors()`: List unique agent IDs that have contributed
   - `merge(otherContext)`: Combine two contexts, with the incoming context overwriting conflicts
   - Optional `EventBus` integration: When provided, publishes `CONTEXT_SHARE` messages on every `set()` call for broadcast to all connected agents

2. **`AgentProtocol`** (`src/collaboration/agent-protocol.ts`): Static factory class for creating structured inter-agent messages. Four protocol message types:
   - `REVIEW_REQUEST`: One agent asks another to review its output (includes output and context payload)
   - `CONTEXT_PROVISION`: An agent proactively shares relevant context data with another
   - `CLARIFICATION_REQUEST`: An agent requests more information, including the question and surrounding context
   - `SUBTASK_DELEGATION`: An agent delegates a defined `AgentTask` to another agent with constraints

3. **`ProtocolMessageType` enum**: Defines the four message types as typed constants, ensuring type safety in message handling.

### Message Structure

All protocol messages use the existing `AgentMessage` type with structured payloads:

```typescript
interface AgentMessage {
  id: string;
  from: string;       // sender agent ID
  to: string;         // target agent ID
  type: MessageType;  // REQUEST, CONTEXT_SHARE, or TASK_ASSIGNMENT
  payload: {
    protocolType: ProtocolMessageType;
    // ... type-specific fields
  };
  timestamp: Date;
  correlationId: string;
}
```

### Subscription Model

SharedContext uses a `Map<string, Set<callback>>` structure for per-key subscriptions. When a value is set, all callbacks registered for that key are invoked synchronously with the new value and contributing agent ID. This enables agents to react to context changes in real-time without polling.

When an `EventBus` is provided to SharedContext, it additionally broadcasts all changes as `CONTEXT_SHARE` messages, enabling agents that are not directly subscribed to still observe shared state changes through the event system.

## Consequences

### Positive

- Agents can collaborate intelligently by sharing discoveries, decisions, and intermediate results in real-time
- Shared context reduces redundant work, as one agent's findings are immediately available to others
- Structured protocols enable sophisticated workflows (review chains, delegation hierarchies, clarification loops)
- Built on existing `EventBus` infrastructure, requiring no new communication dependencies
- The subscription model allows reactive agent behavior without polling overhead
- Protocol messages are self-describing with typed payloads, making message handling straightforward

### Negative

- Added complexity in message handling, as agents must implement handlers for incoming protocol messages
- Potential for message storms if many agents subscribe to frequently-changing keys
- Synchronous subscriber notification in `SharedContext.set()` means slow callbacks block the setter
- No built-in message ordering guarantees beyond EventBus delivery order
- SharedContext is in-memory only, so session state is lost on process restart

### Neutral

- The protocol is extensible: new `ProtocolMessageType` values can be added without changing existing message handling
- The `merge()` operation uses last-write-wins semantics, which is simple but may not suit all conflict scenarios
- Correlation IDs on messages enable future request/response tracking and conversation threading between agents
- The collaboration layer operates independently of the worker pool, allowing any combination of pool strategies and collaboration patterns
