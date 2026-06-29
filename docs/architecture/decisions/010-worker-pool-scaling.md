# ADR 010: Worker Pool and Agent Scaling

## Status

Accepted

## Context

The agent orchestrator needs to handle concurrent task execution with dynamic scaling based on workload. The initial system assigns tasks 1:1 to agents without load management, meaning there is no mechanism to distribute work across multiple agent instances, balance load, or scale capacity up or down in response to demand.

Requirements include:

- Pool management for multiple agent workers
- Dynamic scaling based on utilization thresholds
- Configurable load balancing strategies for different use cases
- Integration with the existing `AgentOrchestrator` via composition
- Simple in-process model suitable for the current single-node architecture

Options considered:
- **Distributed worker queue (Bull, BullMQ)**: Full job queue with Redis, suited for multi-node but adds infrastructure
- **Kubernetes-based auto-scaling**: Container-level scaling, too heavy for current deployment model
- **In-process worker pool with load balancer**: Lightweight, no external dependencies, immediate feedback loop
- **Static agent allocation**: Fixed number of agents per role, no scaling

## Decision

We will implement `WorkerPool` and `LoadBalancer` classes in the `@builder/agent-system` package (`packages/agent-system/src/pool/`). The pool manages `BaseAgent` instances in-process with configurable min/max bounds and utilization-based scaling decisions.

### Core Components

1. **`WorkerPool`** (`src/pool/worker-pool.ts`): Manages a collection of `BaseAgent` workers with configurable bounds. Supports `addWorker`, `removeWorker`, `getAvailableWorker(taskType)`, `getPoolStats()`, and `scale(targetCount)`. Enforces min/max worker limits. Tracks task completion metrics for average duration calculation. Provides `shouldScaleUp()` and `shouldScaleDown()` methods that compare current utilization against configurable thresholds.

2. **`LoadBalancer`** (`src/pool/load-balancer.ts`): Selects the best agent from the pool for a given task. Implements three strategies:
   - `ROUND_ROBIN`: Simple sequential cycling through available agents
   - `LEAST_LOADED`: Prefers idle agents over working ones based on `AgentState` priority ordering
   - `CAPABILITY_MATCH`: Scores agents by how well their declared capabilities match the task type (name matching and substring inclusion)

### Configuration

```typescript
interface WorkerPoolConfig {
  minWorkers: number;
  maxWorkers: number;
  scaleUpThreshold: number;   // utilization ratio to trigger scale-up
  scaleDownThreshold: number; // utilization ratio to trigger scale-down
  strategy: LoadBalancerStrategy;
}

interface PoolStats {
  totalWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
  queuedTasks: number;
  avgTaskDuration: number;
}
```

### Scaling Logic

The `WorkerPool` determines when to scale based on utilization (active workers / total workers):
- When utilization >= `scaleUpThreshold`, `shouldScaleUp()` returns true
- When utilization <= `scaleDownThreshold`, `shouldScaleDown()` returns true
- The `scale(targetCount)` method clamps the target to `[minWorkers, maxWorkers]` and returns the delta

The orchestrator is responsible for acting on these signals by creating or removing agent instances.

### Integration

The `WorkerPool` integrates with the existing `AgentOrchestrator` via composition. The orchestrator uses `getAvailableWorker(taskType)` to find agents for task assignment instead of direct agent selection.

## Consequences

### Positive

- Better resource utilization through load-aware task distribution
- Configurable strategies allow tuning for different workload patterns (uniform vs. specialized tasks)
- Graceful scaling with min/max bounds prevents resource exhaustion or under-provisioning
- Pool statistics enable monitoring and informed scaling decisions
- The `CAPABILITY_MATCH` strategy enables intelligent routing of specialized tasks to the most appropriate agent

### Negative

- In-process pooling limits scaling to a single Node.js process and available heap memory
- Each agent worker consumes memory proportional to its context and conversation state
- The capability matching uses simple string inclusion rather than a sophisticated skill ontology
- No built-in task queue: if all workers are busy, the caller must handle retry logic

### Neutral

- Distributed execution across multiple machines is a natural future enhancement, as the `WorkerPool` interface could be backed by a remote worker registry
- The load balancer strategies can be extended by adding new `LoadBalancerStrategy` enum values and corresponding selection logic
- Pool metrics (avgTaskDuration, utilization) provide the foundation for auto-scaling policies
