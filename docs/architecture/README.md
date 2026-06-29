# AI Builder Platform - System Architecture

## Overview

The AI Builder Platform is a production-grade autonomous software engineering system that enables users to build full-stack applications through natural language conversations with AI agents. The platform orchestrates multiple specialized AI agents that collaborate to plan, implement, review, test, and deploy complete applications.

## High-Level Architecture

```
+-------------------+       +-------------------+       +-------------------+
|                   |       |                   |       |                   |
|   Next.js Web     | <---> |   NestJS API      | <---> |   PostgreSQL      |
|   (Frontend)      |       |   (Backend)       |       |   (Database)      |
|                   |       |                   |       |                   |
+-------------------+       +--------+----------+       +-------------------+
                                     |
                            +--------+----------+
                            |                   |
                            |   Agent System    |
                            |   (Orchestrator)  |
                            |                   |
                            +--------+----------+
                                     |
                    +----------------+----------------+
                    |                |                |
             +------+------+  +-----+------+  +-----+------+
             |  Planner    |  |  Coder     |  |  Reviewer  |
             |  Agent      |  |  Agent     |  |  Agent     |
             +-------------+  +------------+  +------------+
```

## Services and Responsibilities

### Frontend (Next.js 14 with App Router)

- **Responsibility**: User interface for project management, AI chat, code preview, and deployment controls
- **Technology**: Next.js 14, React 18, Tailwind CSS, shadcn/ui components
- **Communication**: REST API calls to NestJS backend, WebSocket for real-time agent updates
- **Key Features**:
  - Dashboard with project overview and metrics
  - AI chat interface for natural language interaction
  - Real-time code generation preview
  - Project file explorer and editor
  - Deployment status and logs

### Backend API (NestJS)

- **Responsibility**: Business logic, authentication, project management, agent orchestration coordination
- **Technology**: NestJS 10, TypeScript, Prisma ORM, Bull queues
- **Communication**: REST API endpoints, WebSocket gateway, Redis pub/sub for agent events
- **Key Features**:
  - User authentication and authorization (Better Auth)
  - Project CRUD operations
  - Agent task submission and status tracking
  - File system management for generated projects
  - Deployment pipeline triggers

### Agent System (@builder/agent-system)

- **Responsibility**: Multi-agent orchestration for autonomous software engineering
- **Technology**: Custom orchestration engine, AI provider abstraction
- **Communication**: Event-driven via Redis, task queues via Bull
- **Agent Roles**:
  - **Orchestrator**: Decomposes user requests into tasks, assigns to specialized agents
  - **Planner**: Analyzes requirements, creates implementation plans and architecture decisions
  - **Coder**: Generates code following best practices, implements features
  - **Reviewer**: Reviews generated code for quality, security, and correctness
  - **Tester**: Generates and runs tests, validates implementation
  - **Deployer**: Manages build and deployment pipelines

### AI Core (@builder/ai-core)

- **Responsibility**: Unified interface for multiple AI providers
- **Technology**: Provider abstraction pattern, streaming support
- **Supported Providers**: OpenAI (GPT-4), Anthropic (Claude), Google (Gemini)
- **Features**:
  - Provider-agnostic completion API
  - Streaming responses for real-time UX
  - Token usage tracking
  - Automatic failover between providers
  - Rate limiting and cost management

### Database (@builder/database)

- **Responsibility**: Data persistence and schema management
- **Technology**: PostgreSQL 16, Prisma ORM
- **Key Models**: User, Organization, Project, AgentTask, Conversation, Message
- **Features**:
  - Schema migrations via Prisma Migrate
  - Type-safe database client
  - Connection pooling
  - Audit logging

### Shared Package (@builder/shared)

- **Responsibility**: Common types, constants, utilities, and validation schemas
- **Contents**: TypeScript types, enums, utility functions, Zod schemas
- **Consumers**: All other packages and apps

### UI Package (@builder/ui)

- **Responsibility**: Reusable UI component library
- **Technology**: React, Radix UI primitives, Tailwind CSS, shadcn/ui pattern
- **Features**: Accessible components, dark mode support, responsive design

## Communication Patterns

### Request-Response (Synchronous)

Used for standard CRUD operations:
- Frontend makes REST API calls to backend
- Backend queries database and returns response
- Used for: project management, user settings, file operations

### Event-Driven (Asynchronous)

Used for agent orchestration and real-time updates:
- Agent tasks are submitted to Bull queues via Redis
- Agents publish progress events to Redis pub/sub
- Backend forwards events to frontend via WebSocket
- Used for: code generation, build progress, deployment status

### Streaming

Used for AI-powered chat and code generation:
- AI provider responses are streamed to backend
- Backend streams chunks to frontend via Server-Sent Events or WebSocket
- Used for: chat responses, live code generation preview

## Data Flow

1. **User submits request** via chat interface
2. **Backend receives request**, creates conversation record, submits to agent system
3. **Orchestrator agent** decomposes request into sub-tasks
4. **Specialized agents** execute tasks (planning, coding, reviewing, testing)
5. **Progress events** stream back to frontend in real-time
6. **Generated artifacts** (code, tests, docs) stored in project file system
7. **Final result** presented to user with preview and deployment options

## Infrastructure

### Local Development
- PostgreSQL 16 (Docker): Primary data store
- Redis 7 (Docker): Caching, queues, pub/sub
- MinIO (Docker): S3-compatible object storage for generated assets

### Production (planned)
- AWS RDS (PostgreSQL): Managed database
- AWS ElastiCache (Redis): Managed caching and messaging
- AWS S3: Asset storage
- AWS ECS/Fargate: Container orchestration
- CloudFront: CDN for static assets

## Technology Choices

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Monorepo | Turborepo | Fast builds with caching, excellent TypeScript support |
| Frontend | Next.js 14 | App Router, RSC, built-in optimizations |
| Backend | NestJS | Enterprise-grade, decorator-based, excellent DI |
| Database | PostgreSQL + Prisma | Type-safe ORM, robust migrations, JSON support |
| Auth | Better Auth | Modern, flexible, built for TypeScript |
| Styling | Tailwind CSS | Utility-first, consistent design system |
| Components | shadcn/ui | Composable, accessible, customizable |
| AI | Multi-provider | Resilience, cost optimization, best-model selection |
| Queues | Bull (Redis) | Reliable job processing, priority queues |
| Package Manager | pnpm | Fast, disk-efficient, strict dependency resolution |

## Security Considerations

- Authentication via Better Auth with session management
- Role-based access control (RBAC) for organizations and projects
- Input validation on all API endpoints
- Rate limiting on AI provider calls
- Sandboxed code execution for generated applications
- Environment variable isolation between projects
- CORS configuration for cross-origin requests
- Content Security Policy headers
