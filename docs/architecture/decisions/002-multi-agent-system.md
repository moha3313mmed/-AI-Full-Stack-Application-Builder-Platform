# ADR 002: Multi-Agent System Architecture

## Status

Accepted

## Context

The platform needs to autonomously generate full-stack applications from natural language descriptions. This involves multiple complex steps: understanding requirements, planning architecture, generating code, reviewing for quality, writing tests, and managing deployments.

A single monolithic AI prompt cannot reliably handle all these concerns. We need a system that can:

- Break complex requests into manageable sub-tasks
- Apply specialized expertise to each task type
- Maintain context across a multi-step workflow
- Recover from failures in individual steps
- Scale processing across concurrent user requests

The main options considered were:

1. **Single-agent loop**: One LLM call handles everything in a sequential loop
2. **Pipeline architecture**: Fixed sequence of processing stages
3. **Multi-agent orchestration**: Specialized agents coordinated by an orchestrator
4. **Crew-based system**: Peer agents that negotiate and collaborate

## Decision

We will implement a **multi-agent orchestration system** with the following agent roles:

- **Orchestrator Agent**: Receives user requests, decomposes them into a task graph, assigns tasks to specialized agents, and manages the overall workflow
- **Planner Agent**: Analyzes requirements, designs architecture, creates implementation plans with file structures and dependencies
- **Coder Agent**: Generates production-quality code following the plan, handles file creation and modification
- **Reviewer Agent**: Reviews generated code for quality, security vulnerabilities, best practices, and correctness
- **Tester Agent**: Generates unit tests, integration tests, and validates that implementations meet requirements
- **Deployer Agent**: Manages build configurations, deployment scripts, and infrastructure setup

Communication between agents uses an event-driven architecture via Redis pub/sub and Bull queues for reliable task processing.

## Consequences

### Positive

- **Specialization**: Each agent can have optimized prompts, temperature settings, and model selections for its specific task
- **Parallel execution**: Independent tasks (e.g., generating tests while reviewing code) can run concurrently
- **Fault isolation**: A failure in one agent does not crash the entire pipeline; the orchestrator can retry or reassign
- **Scalability**: Agents can be scaled independently based on demand (e.g., more coder agents during peak hours)
- **Observability**: Each agent produces discrete events, making it easy to track progress and debug issues
- **Extensibility**: New agent types can be added without modifying existing agents
- **Quality assurance**: The review-test cycle provides multiple validation passes before presenting results to users

### Negative

- **Complexity**: More moving parts than a simple pipeline; requires careful state management
- **Latency**: Multi-step orchestration adds latency compared to a single LLM call
- **Cost**: Multiple AI provider calls increase token usage and API costs
- **Context management**: Maintaining relevant context across agent boundaries requires careful design
- **Coordination overhead**: The orchestrator must handle dependencies, timeouts, and partial failures

### Mitigations

- Task graph allows maximum parallelization, reducing wall-clock latency
- Context compression and summarization techniques reduce token usage
- Caching of common patterns and templates reduces redundant AI calls
- Circuit breaker pattern prevents cascading failures
- Cost tracking per task enables optimization of model selection (e.g., smaller models for simple tasks)
- Streaming results to the user provides immediate feedback while complex operations complete
