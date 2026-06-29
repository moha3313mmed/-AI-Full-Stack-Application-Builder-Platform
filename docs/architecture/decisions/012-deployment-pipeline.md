# ADR 012: Deployment Pipeline Architecture

## Status

Accepted

## Context

The platform needs to deploy user-generated applications to various hosting providers (Vercel, Netlify, AWS, Docker registries). We need a system that:

- Supports multiple deployment targets without vendor lock-in
- Provides real-time status updates during the build and deploy process
- Handles failures gracefully with automatic rollback capabilities
- Manages environment variables securely across environments
- Scales to support concurrent deployments for multiple users

The main options considered were:

1. **Direct provider integration**: Call each provider's API directly from the deployment service
2. **Strategy pattern with provider adapters**: Abstract providers behind a common interface with swappable implementations
3. **External CI/CD delegation**: Offload to GitHub Actions or similar external pipelines
4. **Hybrid approach**: Internal orchestration with optional external CI/CD triggers

## Decision

We will implement a **provider-agnostic deployment pipeline** using the Strategy pattern:

- **DeploymentPipeline**: Orchestrates the full deployment lifecycle (validate, build, deploy, verify, report)
- **Provider Adapters**: Each deployment target (Vercel, Netlify, AWS S3/CloudFront, Docker) implements a common `DeploymentProvider` interface
- **Deployment Queue**: Deployments are queued and processed asynchronously to prevent blocking and support retries
- **Rollback Manager**: Maintains deployment history per environment, enabling one-click rollback to any previous successful deployment
- **Environment Variable Encryption**: Sensitive values are encrypted at rest using AES-256-GCM and only decrypted during the build/deploy phase

The pipeline stages are: `pending` -> `building` -> `deploying` -> `deployed` (or `failed` with optional `rolled_back`).

## Consequences

### Positive

- **Provider flexibility**: Adding new deployment targets requires only implementing the provider interface, with no changes to core logic
- **Reliability**: Automatic rollback reduces downtime when deployments fail post-deploy verification
- **Security**: Environment variables are never exposed in logs or stored in plaintext
- **Observability**: Each pipeline stage emits events for real-time UI updates and audit logging
- **Concurrency**: Queue-based processing prevents resource contention and supports rate limiting per provider

### Negative

- **Added complexity**: The abstraction layer means more code to maintain compared to direct API calls
- **Latency**: The queue and multi-stage pipeline adds overhead versus a direct deployment call
- **Provider parity**: Not all providers support the same feature set (e.g., preview deployments, edge functions), requiring feature detection
- **State management**: Tracking deployment state across distributed components requires careful coordination

### Mitigations

- Provider capability discovery allows the UI to show only available options per provider
- Optimistic deployments skip the queue for providers with fast deploy times
- Event sourcing for deployment state ensures consistency even during process restarts
- Integration tests validate each provider adapter independently with mock APIs
