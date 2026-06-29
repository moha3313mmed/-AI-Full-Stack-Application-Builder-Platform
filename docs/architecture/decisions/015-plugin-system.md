# ADR 015: Plugin System Architecture

## Status

Accepted

## Context

The platform needs extensibility through third-party plugins that can add new capabilities, integrations, and workflows. We need a system that supports:

- Safe execution of untrusted plugin code with permission-based sandboxing
- Lifecycle management (install, activate, deactivate, uninstall) with state machine transitions
- A plugin SDK providing controlled access to platform capabilities
- Manifest-based plugin definitions with validation and version management
- Registry for discovering and managing installed plugins
- Hook-based extension points allowing plugins to react to platform events

The main options considered were:

1. **Monolithic extension approach**: Plugins compiled into the main application at build time
2. **Runtime plugin loading with sandboxing**: Dynamically loaded plugins with permission isolation
3. **Microservice-based plugins**: Each plugin runs as a separate service communicating via APIs
4. **Webhook-based plugins**: External services triggered via HTTP webhooks at extension points

## Decision

We will implement a **runtime plugin system with permission-based sandboxing and lifecycle management**:

### Plugin Manifest

- Every plugin declares a manifest with metadata (name, version, author), required permissions, supported hooks, and entry point
- Manifests are validated against a strict schema before installation
- Semantic versioning is enforced for compatibility checking

### Lifecycle Management

- Plugins follow a state machine: INSTALLED -> ACTIVE -> INACTIVE -> uninstalled
- Each transition triggers corresponding hooks (onInstall, onActivate, onDeactivate, onUninstall)
- Invalid state transitions are rejected with descriptive errors
- Error states are recoverable through deactivation and reactivation

### Sandboxed Execution

- Plugin code executes within a PermissionGuard that enforces declared permissions
- Available permissions: READ_FILES, WRITE_FILES, NETWORK, AI_ACCESS, DEPLOY, GIT
- Operations without required permissions throw PermissionDeniedError
- Execution timeouts prevent runaway plugins (configurable, default 5 seconds)

### Plugin SDK

- Provides the API surface for plugin authors: registerHook, getContext, readFile, writeFile, callAI, log
- Each SDK method validates permissions before execution
- Structured logging and error reporting for debugging

### Registry

- Central registry manages all installed plugins with CRUD operations
- Supports lookup by hook type for event dispatch
- Prevents duplicate registrations

## Consequences

### Positive

- **Extensibility**: Third parties can add capabilities without modifying core platform code
- **Safety**: Permission sandboxing prevents plugins from accessing unauthorized resources
- **Reliability**: Lifecycle management ensures clean state transitions and resource cleanup
- **Discoverability**: Hook-based lookup enables efficient event dispatch to relevant plugins

### Negative

- **Complexity**: Permission enforcement and lifecycle management add implementation overhead
- **Performance**: Permission checks on every SDK call introduce latency
- **Trust model**: Permission-based sandboxing cannot prevent all categories of malicious behavior
- **API surface**: The plugin SDK represents a long-term API contract that must remain stable

### Mitigations

- Permission checks are O(1) lookups in a Set, adding negligible latency
- Plugin execution is isolated so failures do not cascade to the main application
- Rate limiting and resource quotas prevent denial-of-service from plugins
- SDK versioning allows backwards-compatible evolution of the plugin API
