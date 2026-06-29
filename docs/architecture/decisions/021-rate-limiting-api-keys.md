# ADR 021: Rate Limiting and API Keys

## Status

Accepted

## Context

The AI Builder Platform exposes API endpoints that are accessed by both the web frontend (using JWT sessions) and external integrations (CI/CD systems, scripts, third-party tools). We need to protect the platform from abuse, ensure fair resource distribution, and provide a mechanism for programmatic access that does not require interactive authentication.

Key requirements:
- Rate limiting per user/key to prevent abuse and ensure fair usage
- API key authentication as an alternative to JWT for programmatic access
- Key rotation without service interruption
- Scope-based access control (limit what an API key can do)
- Easy identification of keys for debugging and auditing
- Configurable limits based on subscription plan tier

Options considered:
1. **Fixed window rate limiting**: Simple but allows burst at window boundaries
2. **Sliding window rate limiting**: Smooth rate enforcement, prevents boundary bursting
3. **Token bucket**: Good for bursty traffic but harder to reason about limits
4. **Leaky bucket**: Strict smoothing, but penalizes legitimate burst patterns

For API keys:
1. **Simple random tokens**: Easy to generate but no metadata embedded
2. **Prefixed keys with metadata**: Self-describing, easy to identify origin
3. **JWT-based API tokens**: Stateless but cannot be revoked without a blocklist
4. **OAuth2 client credentials**: Standard but heavy for simple integrations

## Decision

### Rate Limiting

We will implement a **sliding window** rate limiting algorithm with per-user tracking:

**Algorithm**: Sliding window log with Redis sorted sets. Each request is logged with its timestamp. The window slides continuously, providing smooth rate enforcement without boundary burst issues.

**Limits by Plan**:
| Plan | Requests/minute | Requests/hour | AI Requests/day |
|------|----------------|---------------|-----------------|
| FREE | 60 | 1,000 | 100 |
| PRO | 300 | 10,000 | 1,000 |
| TEAM | 600 | 50,000 | 10,000 |
| ENTERPRISE | Custom | Custom | Custom |

**Response Headers**: Rate limit information is returned in standard headers:
- `X-RateLimit-Limit`: Maximum requests allowed in the window
- `X-RateLimit-Remaining`: Requests remaining in the current window
- `X-RateLimit-Reset`: Unix timestamp when the window resets

**Exceeded Response**: When limits are exceeded, a 429 Too Many Requests response is returned with a `Retry-After` header indicating how long the client should wait.

### API Keys

We will implement **prefixed API keys** with the following design:

**Key Format**: `bld_{scope}_{random}` where:
- `bld_` is the platform prefix (identifies keys as belonging to AI Builder)
- `{scope}` is a short code indicating the key's access level (e.g., `rw` for read-write, `ro` for read-only)
- `{random}` is 32 bytes of cryptographically random data, base62 encoded

Example: `bld_rw_7kX9mPqR2vNtYwF5hJcL8dA3bE6gU1sZ`

**Storage**: Only the SHA-256 hash of the key is stored in the database. The full key is shown once at creation time and cannot be retrieved afterward.

**Scopes**: Keys are assigned one or more scopes that limit their access:
- `projects:read` - Read project data
- `projects:write` - Create/update projects
- `deployments:trigger` - Trigger deployments
- `agents:execute` - Run AI agents
- `admin:read` - Read admin data (admin keys only)

**Key Rotation**: Users can create multiple keys simultaneously. Old keys can be deactivated (soft delete) without affecting other active keys. A rotation flow creates a new key and provides a grace period before the old key is deactivated.

**Authentication Flow**: The API accepts keys via the `Authorization: Bearer bld_...` header. The key prefix identifies it as an API key (vs. a JWT). The system hashes the key, looks it up in the database, validates its scopes against the requested operation, and applies rate limits associated with the key's owner plan.

## Consequences

### Positive

- **Abuse prevention**: Sliding window rate limiting provides smooth, predictable enforcement without gaming opportunities
- **Fair usage**: Plan-based limits ensure resources are distributed according to subscription tier
- **Programmatic access**: API keys enable CI/CD integration, scripts, and third-party tools without interactive auth
- **Security**: Hashed storage means compromised database does not expose usable keys
- **Debuggability**: Prefixed keys are immediately identifiable in logs without exposing sensitive data
- **Flexibility**: Scope-based access allows fine-grained control over what each key can do

### Negative

- **Redis dependency**: Rate limiting state is stored in Redis; Redis failure could either block all requests or allow unlimited access (fail-open vs. fail-closed tradeoff)
- **Key management burden**: Users must securely store their API keys; lost keys cannot be recovered
- **Scope complexity**: As the API grows, the scope system may become complex to maintain and understand
- **Storage cost**: Each rate limit window requires Redis memory; high-traffic deployments need appropriately sized Redis instances

### Mitigations

- Rate limiting fails open with logging (allows requests but alerts operations) to prevent Redis outages from causing complete service disruption
- API key management UI provides clear guidance on key security best practices
- Scopes are grouped into logical categories with sensible defaults for common use cases
- Redis memory for rate limiting is bounded by key expiration (old window entries are automatically cleaned)
