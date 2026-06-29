# ADR 022: Monitoring and Observability

## Status

Accepted

## Context

As the AI Builder Platform grows in complexity (multiple services, background workers, external integrations), we need comprehensive observability to understand system behavior, diagnose issues, and maintain reliability. The three pillars of observability (logs, metrics, traces) must be addressed with a coherent strategy that works across all components.

Key requirements:
- Structured logging for machine-parseable log analysis
- Metrics exposition compatible with industry-standard monitoring tools
- Distributed tracing across service boundaries
- Health check endpoints for orchestration platforms (Kubernetes, ECS)
- Minimal performance overhead from instrumentation
- Correlation of logs, metrics, and traces for a single request

Options considered:
1. **Application Performance Monitoring SaaS (Datadog, New Relic)**: Full-featured but expensive and creates vendor lock-in
2. **ELK Stack (Elasticsearch, Logstash, Kibana)**: Powerful log analysis but heavy to operate
3. **Prometheus + Grafana + Jaeger**: Open-source, industry-standard, composable
4. **OpenTelemetry (full SDK)**: Vendor-neutral but significant integration effort
5. **Custom lightweight approach**: Structured logging + Prometheus metrics + W3C Trace Context headers

## Decision

We will implement a **lightweight, standards-based observability stack** that can integrate with multiple backends:

### Structured Logging

All application logs are emitted as **JSON objects** with consistent fields:
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Request completed",
  "service": "api",
  "traceId": "abc123",
  "spanId": "def456",
  "userId": "user_789",
  "method": "GET",
  "path": "/api/projects",
  "statusCode": 200,
  "duration": 45
}
```

**Log Levels**: error (actionable failures), warn (degraded but functional), info (significant operations), debug (development detail). Production runs at info level; debug is enabled per-service for troubleshooting.

**Sensitive Data**: PII and secrets are never logged. User identifiers use internal IDs, not emails. Request/response bodies are logged only at debug level with automatic redaction of sensitive fields.

### Metrics

**Prometheus-compatible metrics** are exposed via a `/metrics` endpoint on each service:

**Request Metrics**:
- `http_requests_total{method, path, status}` - Counter of HTTP requests
- `http_request_duration_seconds{method, path}` - Histogram of request latency
- `http_requests_in_flight` - Gauge of concurrent requests

**Business Metrics**:
- `ai_requests_total{provider, model}` - Counter of AI API calls
- `deployments_total{status}` - Counter of deployment operations
- `active_users_gauge` - Current active user count
- `job_queue_depth{queue}` - Current depth of each job queue

**System Metrics**:
- `nodejs_heap_used_bytes` - Node.js memory usage
- `nodejs_event_loop_lag_seconds` - Event loop latency
- `redis_connection_pool_size` - Active Redis connections

### Health Checks

A **health check registry** provides hierarchical service health:

- `GET /health` - Simple liveness check (returns 200 if the process is running)
- `GET /health/ready` - Readiness check (returns 200 only if all dependencies are connected)
- `GET /health/detailed` - Full dependency status (protected, admin-only):
  ```json
  {
    "status": "healthy",
    "uptime": 86400,
    "dependencies": {
      "database": { "status": "healthy", "latency": 3 },
      "redis": { "status": "healthy", "latency": 1 },
      "queue": { "status": "degraded", "latency": 45 }
    }
  }
  ```

### Distributed Tracing

**W3C Trace Context** propagation (via `traceparent` and `tracestate` headers) enables request tracing across service boundaries:

- Each incoming request without a trace context generates a new trace ID
- Trace IDs are propagated to downstream service calls, database queries, and queue jobs
- Trace IDs are included in all log entries for correlation
- Integration with OpenTelemetry-compatible collectors is supported but not required initially

## Consequences

### Positive

- **Debugging velocity**: Structured logs with trace IDs enable rapid issue diagnosis by correlating all events for a single request
- **Operational visibility**: Prometheus metrics provide real-time dashboards and alerting capabilities
- **Standards compliance**: W3C Trace Context and Prometheus formats ensure compatibility with the broader ecosystem
- **Low overhead**: Lightweight instrumentation (counters, histograms) adds minimal latency
- **Flexibility**: Can integrate with any Prometheus-compatible backend (Grafana Cloud, AWS Managed Prometheus, self-hosted)
- **Health orchestration**: Kubernetes/ECS can use health endpoints for automated recovery and rolling deployments

### Negative

- **Instrumentation effort**: Every new endpoint and service must be instrumented; coverage gaps reduce observability value
- **Storage costs**: High-cardinality metrics and verbose logging generate significant data volume
- **Alert fatigue**: Without careful threshold tuning, monitoring can generate excessive noise
- **Trace sampling**: Full tracing at 100% of requests is expensive; sampling reduces visibility for infrequent issues

### Mitigations

- NestJS interceptors automatically instrument all HTTP endpoints, ensuring baseline coverage without per-endpoint effort
- Log rotation and retention policies limit storage costs (7 days hot, 30 days warm, 90 days cold)
- Alert runbooks document expected thresholds and escalation procedures
- Adaptive trace sampling (100% for errors, 10% for successful requests) balances cost and visibility
