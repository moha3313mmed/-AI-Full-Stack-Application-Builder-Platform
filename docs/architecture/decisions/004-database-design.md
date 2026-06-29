# ADR 004: Database Design with PostgreSQL and Prisma

## Status

Accepted

## Context

The platform needs to persist various types of data: user accounts, organizations, projects, conversation histories, agent tasks, generated files, and deployment configurations. We need to choose:

1. A database engine that can handle relational data with complex queries
2. An ORM or query builder that provides type safety in TypeScript
3. A schema management strategy for migrations

Key requirements:
- Strong relational integrity (users own projects, projects belong to organizations)
- JSON storage for flexible configuration data (project settings, agent metadata)
- Full-text search capability for conversations and code
- Concurrent access for multiple agent workers
- Audit trails for compliance

Options considered:
- **MongoDB + Mongoose**: Document-oriented, flexible schema
- **PostgreSQL + Prisma**: Relational with type-safe ORM
- **PostgreSQL + Drizzle**: Relational with SQL-like type-safe builder
- **PostgreSQL + TypeORM**: Relational with decorator-based ORM

## Decision

We will use **PostgreSQL 16** as our primary database with **Prisma ORM** for type-safe data access.

### Schema Design Principles

1. **Core entities use relational modeling**: Users, Organizations, Projects have strict schemas with foreign keys and constraints
2. **Flexible data uses JSON columns**: Project settings, agent configurations, and metadata use PostgreSQL's JSONB type
3. **Timestamps on all entities**: `createdAt` and `updatedAt` for audit trails
4. **Soft deletes where appropriate**: Projects can be archived rather than hard-deleted
5. **CUID identifiers**: Using CUIDs for primary keys (sortable, collision-resistant, URL-safe)

### Core Models

- **User**: Authentication identity with profile information and role
- **Organization**: Multi-tenancy support for teams
- **Project**: The central entity representing a generated application
- **OrganizationMember**: Join table with role-based access within organizations

### Naming Conventions

- Tables: snake_case plural (e.g., `organization_members`)
- Columns: snake_case (e.g., `created_at`)
- Prisma models: PascalCase (e.g., `OrganizationMember`)
- Prisma uses `@@map` to bridge naming conventions

## Consequences

### Positive

- **Type safety**: Prisma generates TypeScript types from the schema, eliminating runtime type errors in database operations
- **Migration management**: Prisma Migrate provides versioned, reviewable migration files
- **PostgreSQL features**: JSONB columns, full-text search, CTEs, window functions available when needed
- **Performance**: PostgreSQL's query planner handles complex joins efficiently; connection pooling via PgBouncer for production
- **Developer experience**: Prisma Studio for data browsing, excellent VS Code integration, auto-completion
- **Ecosystem**: Prisma is widely adopted with strong community support and documentation

### Negative

- **Prisma limitations**: Some advanced PostgreSQL features (custom types, stored procedures) require raw SQL
- **N+1 queries**: Must be careful with nested includes; Prisma does not batch by default
- **Migration conflicts**: Team members may create conflicting migrations in parallel
- **Cold starts**: Prisma Client generation adds to build time
- **Schema drift**: Must keep Prisma schema in sync with actual database

### Mitigations

- Use `prisma.$queryRaw` for complex queries that exceed ORM capabilities
- Implement data loaders for batch fetching in GraphQL-like patterns
- CI checks ensure migrations are in order before merge
- Prisma Client is generated during the build step, cached by Turborepo
- Regular schema validation in CI comparing Prisma schema to actual database
