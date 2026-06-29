# ADR 018: Performance Caching Strategy

## Status

Accepted

## Context

The AI Builder Platform serves a growing number of users who make frequent read requests to list projects, agents, deployments, and other resources. Database queries for these operations become a bottleneck at scale, particularly for list endpoints that aggregate data. We need a caching layer that reduces database load, improves response times, and remains consistent with the source of truth.

Key requirements:
- Reduce database read load for frequently accessed resources
- Sub-10ms response times for cached data
- Support cache invalidation when data changes
- Namespace isolation between tenants
- Graceful degradation if the cache is unavailable

Options considered:
1. **In-memory application cache (node-cache)**: Simple but not shared across instances, leading to inconsistencies in a multi-replica deployment
2. **Redis as a standalone cache-aside layer**: Shared, fast, battle-tested, supports TTLs and pub/sub
3. **CDN edge caching**: Only suitable for static/public content, not authenticated API responses
4. **Database materialized views**: Adds complexity to schema management and is not suitable for all query patterns

## Decision

We will use **Redis as a cache-aside (lazy-loading) layer** with the following strategy:

**Pattern**: Cache-aside (read-through on miss, invalidate on write). On cache miss, the service fetches from the database, stores the result in Redis, then returns it. On data mutation, the cache entry is invalidated rather than updated, avoiding stale-write races.

**TTL Strategy**:
- List endpoints (e.g., project lists, user lists): 60 seconds
- Individual resource lookups (e.g., single project by ID): 120 seconds
- Configuration/settings data: 300 seconds
- Health check data: 10 seconds

**Namespace Prefixing**: All cache keys follow the pattern `{service}:{entity}:{identifier}` (e.g., `api:projects:list:user_123`, `api:project:proj_456`). This prevents key collisions and enables targeted bulk invalidation.

**Tag-based Invalidation**: Related cache entries are linked via tags. When a project is updated, all cache entries tagged with that project ID are invalidated, including the owning user's project list. Tags are implemented as Redis Sets containing the keys associated with each tag.

**Serialization**: JSON serialization for cached objects (simple, debuggable). Binary formats (MessagePack) may be adopted later if payload size becomes a concern.

**Connection Management**: The cache module uses a connection pool with automatic reconnection. If Redis is unavailable, requests fall through to the database without error, logging a warning for operational visibility.

## Consequences

### Positive

- **Reduced database load**: Frequently accessed data is served from memory, reducing PostgreSQL query volume by an estimated 60-80% for read-heavy endpoints
- **Improved response times**: Redis responses are typically under 2ms, compared to 10-50ms for database queries
- **Scalability**: Cache layer scales horizontally with Redis Cluster if needed
- **Isolation**: Namespace prefixing prevents cross-tenant data leakage
- **Resilience**: Graceful degradation ensures the application continues operating if Redis is unavailable

### Negative

- **Eventual consistency**: Data may be stale for up to the TTL duration after a write; not suitable for real-time accuracy requirements
- **Memory usage**: Redis memory must be monitored and sized appropriately; eviction policies (allkeys-lru) must be configured
- **Complexity**: Invalidation logic adds code paths that must be maintained alongside business logic
- **Cold start**: After cache flush or Redis restart, the database absorbs full read load until the cache warms

### Mitigations

- Critical operations (e.g., billing, auth) bypass the cache and always read from the database
- A cache warming job runs on deployment to pre-populate frequently accessed data
- Redis memory is monitored with alerts at 70% and 90% utilization thresholds
- Tag-based invalidation ensures related entries are consistently purged
