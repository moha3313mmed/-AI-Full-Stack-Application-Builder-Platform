# ADR 005: Authentication with Better Auth

## Status

Accepted

## Context

The platform needs robust user authentication and authorization to protect user data, manage project access, and enforce organization-level permissions. Requirements include:

- Email/password authentication
- OAuth providers (GitHub, Google) for developer-friendly sign-up
- Session management with secure cookies
- Role-based access control at user and organization levels
- API token support for programmatic access
- Multi-tenancy with organization switching

Options considered:
- **NextAuth.js (Auth.js)**: Popular in Next.js ecosystem, broad provider support
- **Better Auth**: Modern TypeScript-first auth library with plugin system
- **Clerk**: Managed auth service with pre-built UI components
- **Lucia Auth**: Lightweight, flexible auth library
- **Custom implementation**: Build from scratch with JWT/sessions

## Decision

We will use **Better Auth** as our authentication framework for the following reasons:

1. **TypeScript-first**: Built entirely in TypeScript with full type inference
2. **Framework-agnostic core**: Works with both Next.js frontend and NestJS backend
3. **Plugin architecture**: Extensible with plugins for organizations, two-factor auth, rate limiting
4. **Database adapter**: Direct Prisma integration, stores sessions in our existing database
5. **Modern security**: Implements current best practices (CSRF protection, secure cookies, session rotation)

### Authentication Flow

```
User -> Next.js Frontend -> Better Auth Client
                                    |
                                    v
                           Better Auth Server (API)
                                    |
                                    v
                           PostgreSQL (sessions, users)
```

### Authorization Model

- **User roles**: USER, ADMIN, SUPER_ADMIN (platform-level)
- **Organization roles**: OWNER, ADMIN, MEMBER, VIEWER (org-level)
- **Project access**: Inherited from organization membership or direct user ownership

## Consequences

### Positive

- **Type safety**: Auth state is fully typed, including session data and user properties
- **No external dependency**: Sessions stored in our own database, no third-party service required
- **Cost effective**: Open-source with no per-user pricing
- **Customizable UI**: We build our own auth pages, matching our design system
- **Plugin ecosystem**: Organizations, rate limiting, and 2FA available as plugins
- **API compatibility**: Works seamlessly with both REST endpoints and server components

### Negative

- **Newer library**: Less battle-tested than NextAuth or Passport.js
- **Smaller community**: Fewer Stack Overflow answers and community resources
- **Self-managed**: We handle security updates, session cleanup, and token rotation ourselves
- **Migration effort**: If we need to switch later, session migration would be complex

### Mitigations

- Better Auth has comprehensive documentation and active maintenance
- Security best practices are encoded in the library defaults
- Session cleanup is handled via scheduled database jobs
- Abstraction layer around auth operations allows future provider switching
- Regular security audits of authentication flows
- Rate limiting plugin prevents brute-force attacks
