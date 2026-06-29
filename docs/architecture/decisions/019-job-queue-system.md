# ADR 019: Job Queue System

## Status

Accepted

## Context

The AI Builder Platform performs numerous operations that are too long-running or resource-intensive to handle synchronously within HTTP request-response cycles. These include AI code generation (which may take 10-60 seconds), deployment pipelines, security scans, scheduled maintenance tasks, and email/notification delivery. We need an asynchronous job processing system that provides reliability, visibility, and scalability.

Key requirements:
- Reliable job processing with at-least-once delivery
- Priority-based execution (user-facing jobs before background maintenance)
- Retry logic with configurable backoff for transient failures
- Scheduled and repeatable jobs (e.g., daily security scans)
- Job progress tracking and status visibility
- Horizontal scaling of worker processes
- Graceful shutdown without losing in-progress work

Options considered:
1. **AWS SQS + Lambda**: Managed, scalable, but adds AWS coupling and cold start latency
2. **RabbitMQ**: Full-featured message broker, but requires separate infrastructure
3. **BullMQ (Redis-based)**: Purpose-built for Node.js, uses existing Redis infrastructure, rich feature set
4. **Temporal**: Workflow orchestration engine, powerful but heavy for our current needs

## Decision

We will use **BullMQ** as our job queue system, leveraging the existing Redis infrastructure already used for caching. The implementation follows these design principles:

**Queue Architecture**: Separate named queues for different job categories:
- `code-generation` (priority: high, concurrency: 4)
- `deployments` (priority: high, concurrency: 2)
- `security-scans` (priority: medium, concurrency: 3)
- `notifications` (priority: low, concurrency: 10)
- `maintenance` (priority: low, concurrency: 1)

**Retry Strategy**: Exponential backoff with jitter:
- Default: 3 attempts with delays of 5s, 30s, 180s
- Code generation: 2 attempts with delays of 10s, 60s (expensive operations)
- Notifications: 5 attempts with delays of 1s, 5s, 15s, 60s, 300s

**Worker Concurrency Model**: Each worker process runs configurable concurrency per queue. Workers are deployed as separate processes from the API to isolate resource usage. Worker auto-scaling is based on queue depth metrics.

**Scheduled Jobs**: BullMQ repeatable jobs handle recurring tasks:
- Cache cleanup: every 1 hour
- Security scan (full): daily at 02:00 UTC
- Usage metrics aggregation: every 15 minutes
- Stale deployment cleanup: every 6 hours

**Graceful Shutdown**: Workers listen for SIGTERM, stop accepting new jobs, and wait up to 30 seconds for in-progress jobs to complete before forceful termination. Jobs interrupted during shutdown are returned to the queue automatically by BullMQ's stalled job detection.

**Job Events and Progress**: Jobs emit progress events that are stored and exposed via the admin API, enabling real-time status updates for long-running operations like deployments and code generation.

## Consequences

### Positive

- **Reliability**: Redis persistence and BullMQ's acknowledgment model ensure jobs are not lost
- **Visibility**: Built-in job lifecycle events (waiting, active, completed, failed) enable monitoring dashboards
- **Performance**: Decoupling async work from HTTP handlers keeps API response times low
- **Scalability**: Workers can be scaled independently based on queue depth
- **Developer experience**: BullMQ provides a clean TypeScript API with strong typing for job data
- **Reuse**: Leverages existing Redis infrastructure, no new dependencies to operate

### Negative

- **Redis dependency**: Job queue reliability is now coupled to Redis availability; Redis failure affects both caching and job processing
- **Complexity**: Distributed job processing introduces failure modes (duplicate processing, stalled jobs) that require monitoring
- **Memory pressure**: Large job payloads stored in Redis can consume significant memory
- **Ordering**: Strict FIFO ordering is not guaranteed across priority levels; high-priority jobs may starve lower priorities under load

### Mitigations

- Redis is deployed with persistence (AOF) and replication for durability
- BullMQ's stalled job detection automatically retries jobs from crashed workers
- Job payloads are kept minimal (IDs and references rather than full data)
- Queue depth alerts trigger scaling actions before starvation occurs
- Dead letter queue captures jobs that exhaust all retries for manual investigation
