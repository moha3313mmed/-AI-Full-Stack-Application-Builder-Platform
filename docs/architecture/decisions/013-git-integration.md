# ADR 013: Git Integration Architecture

## Status

Accepted

## Context

The platform generates code via AI agents and needs to persist changes in version control. Users expect standard Git workflows (branches, commits, pull requests) integrated with the AI-driven development process. We need:

- Support for multiple Git hosting providers (GitHub, GitLab, Bitbucket)
- A pipeline to commit AI-generated file changes to the repository
- Branch management for parallel feature development
- Pull request creation and tracking for code review workflows
- Conflict detection and resolution when multiple agents or users modify the same files

The main options considered were:

1. **Direct Git CLI integration**: Shell out to git commands on the server
2. **Provider API abstraction**: Use each provider's REST/GraphQL API through a common interface
3. **Isomorphic Git (in-memory)**: Use a JavaScript Git implementation for server-side operations
4. **Hybrid CLI + API**: Use git CLI for local operations and provider APIs for remote operations

## Decision

We will implement a **Git provider abstraction layer** with a hybrid approach:

- **GitProvider Interface**: Common interface for operations like `createBranch`, `commit`, `createPullRequest`, `listBranches`, `getCommitHistory`
- **Provider Adapters**: GitHub, GitLab, and Bitbucket adapters that implement the interface using their respective APIs
- **VFS-to-Git Pipeline**: When the virtual file system detects changes from agent operations, a commit pipeline batches related file changes into atomic commits with descriptive messages
- **Branch Strategy**: Each AI task creates a feature branch, and completed work is submitted as a pull request to the default branch
- **Conflict Resolution**: Before committing, the pipeline checks for upstream changes and either rebases automatically (for non-overlapping changes) or flags conflicts for user resolution

The commit pipeline stages are: detect changes -> group by task -> generate commit message -> check conflicts -> commit -> push -> create PR (if configured).

## Consequences

### Positive

- **Provider independence**: Users can connect any supported Git provider without workflow changes
- **Atomic commits**: AI-generated changes are grouped logically rather than as a single monolithic commit
- **Traceability**: Every code change is linked to the originating task or agent action
- **Familiar workflow**: Developers review AI-generated code through standard pull request processes
- **Safety**: Feature branches isolate experimental changes from the production branch

### Negative

- **API rate limits**: Provider APIs have rate limits that can throttle high-frequency commit operations
- **Authentication complexity**: Managing OAuth tokens and SSH keys for multiple providers adds security surface
- **Merge conflicts**: Automated conflict resolution has limits and may require user intervention
- **Eventual consistency**: There is a delay between file system changes and Git commits appearing on the remote

### Mitigations

- Request batching and caching reduce API calls and avoid rate limit issues
- Token refresh and credential rotation are handled by a dedicated auth service
- Conflict detection happens early (before committing) with clear UI indicators for manual resolution
- Webhook subscriptions keep the local state synchronized with remote changes from other contributors
