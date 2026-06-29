# ADR 023: Platform Configuration and Secrets Management

## Status

Accepted

## Context

The AI Builder Platform integrates with numerous external services (AI providers, deployment platforms, source control, authentication, databases, storage, email, payments, monitoring). Managing credentials for these services through environment files (.env) introduces several operational challenges:

- **Deployment friction**: Every credential change requires a redeployment or manual server-side file edit
- **Security risk**: Environment files are often stored in plaintext on disk, shared insecurely between team members, or accidentally committed to version control
- **No audit trail**: Changes to environment variables are not tracked, making it impossible to determine who changed what and when
- **No validation**: Invalid credentials are only discovered at runtime when a service call fails
- **Key rotation difficulty**: Rotating a compromised key requires coordinated file edits and redeployments across all instances

We need a centralized, secure, auditable system for managing platform-wide credentials and configuration that eliminates manual .env file management after initial deployment.

## Decision

We will implement a **Platform Configuration module** with the following architecture:

### Data Model

A `PlatformConfig` model stores all configuration entries with:
- **Category-based organization**: Configs are grouped by `ConfigCategory` enum (AI_PROVIDERS, DEPLOYMENT_PROVIDERS, SOURCE_CONTROL, AUTH_PROVIDERS, DATABASES, OBJECT_STORAGE, EMAIL_PROVIDERS, PAYMENT_PROVIDERS, MONITORING_ANALYTICS)
- **Unique constraint**: Each (category, key) pair is unique, preventing duplicate entries
- **Metadata support**: JSON metadata field allows storing provider-specific configuration alongside the credential

### Encryption at Rest

All secret values are encrypted using **AES-256-GCM** before storage:
- A platform-wide encryption key (`PLATFORM_ENCRYPTION_KEY`) is the only secret that must remain in the environment
- Each encrypted value stores: initialization vector (IV) + authentication tag + ciphertext (base64-encoded, colon-separated)
- GCM mode provides both confidentiality and integrity verification (authenticated encryption)
- Key rotation re-encrypts all stored values with a new key without service interruption

### Caching Strategy

Configuration values are cached in Redis with a 300-second TTL under the `platform-config` namespace:
- Reads first check the cache, then fall back to the database
- Writes invalidate the relevant cache entries immediately
- This reduces database load for frequently-accessed credentials (e.g., AI provider keys used on every request)

### DynamicConfigService (Fallback Pattern)

A `DynamicConfigService` provides a unified interface for accessing configuration:
1. Check Redis cache for the decrypted value
2. Query the database and decrypt if found
3. Fall back to the environment variable via NestJS ConfigService

This allows gradual migration from .env-based configuration to database-stored configuration without breaking existing services.

### Access Control

All configuration endpoints are protected by a `SuperAdminGuard` that restricts access to users with the SUPER_ADMIN role only. Regular administrators cannot view or modify platform credentials.

### Audit Logging

Every configuration change (create, update, delete, key rotation, backup, restore) is recorded in the audit log with:
- The acting user ID
- The action performed
- The affected resource (category + key)
- Timestamp and metadata

### Frontend Integration

An admin configuration page provides:
- Category-based tab navigation for all provider types
- Pre-populated fields showing known provider configurations per category (even when not yet configured)
- Masked secret display (values are never sent to the frontend in plaintext)
- Edit dialog with password-type input and reveal toggle
- Test connection capability for validating credentials before enabling
- Audit log viewer showing recent configuration changes

## Consequences

### Positive

- **No .env edits after deployment**: All credentials are managed through the admin UI
- **Complete audit trail**: Every change is logged with who, what, and when
- **Encryption at rest**: Compromised database backups do not expose plaintext secrets
- **Key rotation**: Encryption keys can be rotated without credential re-entry
- **Connection testing**: Invalid credentials are caught before they affect users
- **Backup and restore**: Full configuration can be exported and imported for disaster recovery or environment cloning
- **Gradual migration**: DynamicConfigService fallback allows incremental adoption without breaking existing env-based configuration

### Negative

- **Added complexity**: An encryption layer and caching strategy increase system complexity
- **Single point of failure**: The PLATFORM_ENCRYPTION_KEY environment variable must be securely managed and backed up; losing it means losing access to all stored secrets
- **Cache invalidation**: Stale cache entries (up to 300s) could serve outdated credentials after a change
- **Performance overhead**: Decryption on every cache miss adds latency to credential access
- **Migration effort**: Existing services must be updated to use DynamicConfigService instead of direct ConfigService access for full benefit

### Mitigations

- The encryption key is the only secret that requires traditional secret management (e.g., AWS Secrets Manager, Vault)
- Cache invalidation on writes ensures that intentional changes propagate immediately; only concurrent reads during the write window may see stale data
- AES-256-GCM decryption is fast (sub-millisecond) and the caching layer minimizes how often decryption occurs
- DynamicConfigService's fallback pattern means services continue working even if the platform config database is temporarily unavailable
