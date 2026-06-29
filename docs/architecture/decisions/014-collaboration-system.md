# ADR 014: Collaboration System Architecture

## Status

Accepted

## Context

The platform supports teams working on projects together. We need collaboration features that enable:

- Role-based access control with granular permissions
- Real-time awareness of who is currently active on a project
- Threaded discussions attached to projects, files, or specific code sections
- An activity feed showing all project events for team awareness
- Permission inheritance so that organization-level settings propagate to projects

The main options considered were:

1. **Simple RBAC with flat roles**: Owner, Member, Viewer with hardcoded permissions
2. **Hierarchical RBAC with permission inheritance**: Organization -> Project -> Resource level permissions
3. **Attribute-based access control (ABAC)**: Fine-grained rules based on user attributes and resource properties
4. **Hybrid RBAC + resource-level overrides**: Role-based defaults with per-resource permission overrides

## Decision

We will implement a **hierarchical RBAC system with real-time collaboration features**:

### Permissions Model

- **Roles**: Owner, Admin, Member, Viewer with hierarchical permission inheritance
- **Permission Scopes**: Organization-level roles cascade to all projects unless overridden at the project level
- **Permission Resolution**: Check project-level role first, fall back to organization-level role, deny by default
- **Actions**: Permissions map to discrete actions (read, write, deploy, manage_members, admin) rather than broad access levels

### Real-Time Presence

- **WebSocket connections**: Each authenticated user maintains a WebSocket connection when viewing a project
- **Presence heartbeat**: Clients send periodic heartbeats; absence for more than 30 seconds marks the user as offline
- **Presence broadcasting**: Active user lists are broadcast to all connected clients on the same project

### Threaded Comments

- **Comment model**: Comments belong to a project and optionally reference a target (file, line, deployment, etc.)
- **Threading**: Comments support one level of nesting (replies to top-level comments)
- **Notifications**: Mentioned users and thread participants receive notifications on new replies

### Activity Event Sourcing

- **Event log**: All significant actions (commits, deploys, member changes, comments) are recorded as immutable events
- **Feed generation**: The activity feed is derived from the event log with filtering by type and actor
- **Audit trail**: The event log doubles as an audit trail for compliance and debugging

## Consequences

### Positive

- **Security**: Hierarchical permissions prevent accidental over-provisioning of access
- **Team awareness**: Real-time presence reduces coordination conflicts (two people editing the same file)
- **Communication**: In-context comments reduce context switching between the IDE and external communication tools
- **Traceability**: The event log provides a complete history of project changes for auditing
- **Scalability**: Event sourcing allows efficient feed generation and historical queries

### Negative

- **Complexity**: Hierarchical permission resolution requires careful implementation and testing
- **WebSocket overhead**: Maintaining persistent connections for presence increases server resource usage
- **Storage growth**: The event log grows indefinitely and requires archival or retention policies
- **Notification fatigue**: Active projects may generate excessive notifications without proper filtering

### Mitigations

- Permission resolution is cached per session and invalidated on role changes
- WebSocket connections are multiplexed and idle connections are cleaned up aggressively
- Event log uses time-based partitioning with configurable retention (default 90 days for feed, permanent for audit)
- Users can configure notification preferences per project (all, mentions only, none)
- Rate limiting on presence broadcasts prevents network saturation in large teams
