# ADR 001: Monorepo Structure with Turborepo

## Status

Accepted

## Context

The AI Builder Platform consists of multiple interconnected services and shared packages: a Next.js frontend, a NestJS backend, and several shared libraries (types, database, AI core, agent system, UI components). We need to decide how to organize the codebase to maximize developer productivity, ensure type safety across boundaries, and enable efficient CI/CD.

The main options considered were:

1. **Polyrepo**: Each service/package in its own repository
2. **Monorepo with Nx**: Single repository using the Nx build system
3. **Monorepo with Turborepo**: Single repository using Turborepo
4. **Monorepo with Lerna**: Traditional JavaScript monorepo tooling

Key requirements:
- Shared TypeScript types between frontend and backend
- Fast incremental builds during development
- Efficient CI pipeline with caching
- Simple dependency management between internal packages
- Good developer experience with IDE support

## Decision

We will use a **Turborepo monorepo** with pnpm workspaces, organized as:

```
/
  apps/
    web/        - Next.js frontend
    api/        - NestJS backend
  packages/
    shared/     - Types, constants, utilities
    database/   - Prisma schema and client
    ai-core/    - AI provider abstraction
    agent-system/ - Multi-agent orchestration
    ui/         - Shared component library
```

Package naming follows the `@builder/` scope convention (e.g., `@builder/shared`, `@builder/ai-core`).

## Consequences

### Positive

- **Type safety across boundaries**: Shared types are imported directly, ensuring frontend and backend stay in sync without code generation or API schemas
- **Atomic changes**: A single PR can modify both the API and frontend, ensuring they deploy together
- **Fast builds**: Turborepo's task caching and parallel execution significantly reduce build times. Unchanged packages are not rebuilt.
- **Simplified dependency management**: Internal packages use `workspace:*` protocol, eliminating version mismatches
- **Unified tooling**: Single ESLint, Prettier, and TypeScript configuration applies consistently
- **Better refactoring**: IDE can find all usages across the entire codebase
- **Reduced boilerplate**: Shared configurations (tsconfig, eslint) are inherited, not duplicated

### Negative

- **Repository size**: Clone and initial install may be slower as the project grows
- **CI complexity**: Must configure proper caching and affected-package detection
- **Build ordering**: Must correctly declare dependencies in turbo.json so packages build in the right order
- **Learning curve**: Team members must understand workspace protocols and Turborepo concepts
- **Deployment coupling**: Requires careful consideration of which services need redeployment when shared packages change

### Mitigations

- Turborepo remote caching reduces CI build times for unchanged packages
- pnpm's strict dependency resolution prevents phantom dependency issues
- TypeScript project references enable incremental compilation
- Docker multi-stage builds isolate deployment artifacts per service
