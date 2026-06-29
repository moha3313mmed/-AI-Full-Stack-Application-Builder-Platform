# AI Builder Platform

A production-grade autonomous software engineering platform that enables users to build full-stack applications through natural language conversations with specialized AI agents.

## Vision

AI Builder Platform brings the power of autonomous software engineering to developers and non-developers alike. Describe what you want to build in plain English, and the platform's multi-agent system will plan the architecture, generate production-quality code, write tests, and deploy your application.

## Core Capabilities

### Parallel Multi-Agent Orchestration

The platform executes multiple specialized agents simultaneously using a DAG-based task scheduler. A worker pool with configurable concurrency enables true parallel code generation, while an output merger resolves file-level conflicts between agents working on the same codebase. A shared context system ensures agents stay coordinated throughout execution.

### Sandboxed Preview Environment

Generated applications are built and served in isolated sandbox environments. The preview server supports:

- Real-time hot reload on file changes
- Runtime error reporting with source-mapped stack traces
- Streaming build logs
- Console output capture
- Automatic refresh after AI-generated changes
- Concurrent sandbox management with resource limits

### Automatic Recovery and Rollback

A validation pipeline continuously monitors build health after every code generation cycle. When failures are detected, the system:

- Creates checkpoints before risky operations
- Detects build and runtime failures automatically
- Identifies the problematic change via snapshot comparison
- Restores the last known working version
- Notifies the user with full diagnostics
- Supports retry with alternative AI strategies

### Persistent Long-Term Project Memory

All conversations, architectural decisions, generated code history, user preferences, and project context are permanently stored and automatically restored across sessions. The memory system includes:

- Automatic extraction of patterns, decisions, and preferences from conversations
- Category-based organization (architecture, patterns, preferences, context)
- Conversation summarization for efficient context retrieval
- Integration with the workflow engine for memory-aware code generation

## Architecture Overview

The platform uses a multi-agent orchestration architecture where specialized AI agents collaborate to deliver complete applications:

- **Manager Agent** - Decomposes requests into parallel task graphs and coordinates execution
- **Planner Agent** - Designs architecture and creates implementation plans
- **Frontend Agent** - Generates UI components and page layouts
- **Backend Agent** - Creates API endpoints, services, and data models
- **Reviewer Agent** - Reviews code for quality, security, and best practices
- **Tester Agent** - Generates and validates tests
- **Deployer Agent** - Manages build and deployment pipelines

For detailed architecture documentation, see [docs/architecture/README.md](docs/architecture/README.md).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + pnpm workspaces |
| Frontend | Next.js 14, React 18, Tailwind CSS, shadcn/ui |
| Backend | NestJS 10, TypeScript |
| Preview Server | Express, isolated sandboxes, WebSocket hot-reload |
| Database | PostgreSQL 16, Prisma ORM |
| Authentication | Better Auth |
| AI Providers | OpenAI, Anthropic, Google AI |
| Queues | Bull (Redis) |
| Storage | MinIO (S3-compatible) |
| Containerization | Docker, Docker Compose |

## Project Structure

```
ai-builder-platform/
  apps/
    web/              # Next.js 14 frontend (App Router)
    api/              # NestJS backend API
    preview/          # Sandboxed preview server with hot-reload
  packages/
    shared/           # Shared types, constants, utilities
    database/         # Prisma schema and database client
    ai-core/          # AI provider abstraction layer
    agent-system/     # Multi-agent orchestration engine (DAG scheduler, worker pool, conflict resolution)
    codegen/          # Virtual file system and code generation templates
    memory/           # Project memory store and context builder
    ui/               # Shared React component library
    cache/            # Redis caching layer
    queue/            # Job queue management
    monitoring/       # Health checks, metrics, and tracing
    security/         # Security scanners (secrets, auth, CSRF, vulnerabilities)
    deploy/           # Deployment pipeline (Vercel, Netlify)
    git/              # Git provider integration (GitHub, GitLab)
    plugins/          # Plugin system (marketplace, lifecycle, sandboxing)
    collaboration/    # Real-time collaboration (presence, permissions)
    billing/          # Subscription and billing management
  docs/
    architecture/     # System design documentation
    architecture/decisions/  # Architecture Decision Records
    api/              # API documentation
    guides/           # Developer guides
  docker-compose.yml  # Local development services
```

## Getting Started

### Prerequisites

- **Node.js 22** (use nvm: `nvm use`)
- **pnpm 10.28+** (`corepack enable && corepack prepare pnpm@10.28.1 --activate`)
- **Docker** and **Docker Compose** (for PostgreSQL, Redis, MinIO)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ai-builder-platform
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start infrastructure services:
   ```bash
   docker compose up -d
   ```

5. Run database migrations:
   ```bash
   pnpm db:migrate
   ```

6. Start development servers:
   ```bash
   pnpm dev
   ```

The web app will be available at `http://localhost:3000`, the API at `http://localhost:4000`, and the preview server at `http://localhost:4001`.

### Building

```bash
# Build all packages and apps
pnpm build

# Build a specific package
pnpm --filter @builder/shared build
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @builder/api test
```

### Linting and Type Checking

```bash
# Lint all packages
pnpm lint

# Type-check all packages
pnpm type-check
```

## Development Workflow

1. Create a feature branch from `main`
2. Make changes in the relevant packages
3. Ensure `pnpm build`, `pnpm lint`, and `pnpm type-check` pass
4. Write tests for new functionality
5. Submit a pull request with a descriptive title

### Commit Convention

We use conventional commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `chore:` - Maintenance tasks
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions or modifications

## Architecture Decision Records

Key architectural decisions are documented in [docs/architecture/decisions/](docs/architecture/decisions/):

- [001 - Monorepo Structure](docs/architecture/decisions/001-monorepo-structure.md)
- [002 - Multi-Agent System](docs/architecture/decisions/002-multi-agent-system.md)
- [003 - AI Provider Abstraction](docs/architecture/decisions/003-ai-provider-abstraction.md)
- [004 - Database Design](docs/architecture/decisions/004-database-design.md)
- [005 - Authentication](docs/architecture/decisions/005-authentication.md)

## License

Private - All rights reserved.
