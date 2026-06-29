# ADR 020: Billing and Subscription Model

## Status

Accepted

## Context

The AI Builder Platform needs a billing system to support subscription-based access to features and usage-based metering for resource consumption (AI requests, compute time, storage). The system must support multiple plan tiers, handle upgrades/downgrades, enforce quotas, and be flexible enough to switch payment providers if needed.

Key requirements:
- Support tiered subscription plans (FREE, PRO, TEAM, ENTERPRISE)
- Usage-based metering for AI requests and compute resources
- Quota enforcement at the API layer (not just billing)
- Provider-agnostic architecture (not locked to a single payment processor)
- Support for trial periods, proration, and plan changes
- Webhook handling for asynchronous payment events
- Audit trail for all billing events

Options considered:
1. **Direct Stripe integration**: Fast to implement but creates tight coupling to Stripe's API
2. **Custom billing engine**: Maximum flexibility but enormous implementation effort
3. **Provider-agnostic adapter pattern**: Abstract billing operations behind an interface, implement adapters per provider
4. **Third-party billing platforms (Chargebee, Recurly)**: Add another SaaS dependency and monthly cost

## Decision

We will implement a **provider-agnostic billing architecture** using the adapter pattern:

**Core Abstraction**: A `BillingProvider` interface defines operations (createSubscription, cancelSubscription, updatePlan, recordUsage, getInvoices). Concrete adapters implement this interface for specific providers.

**First Adapter**: Stripe adapter as the initial implementation, handling:
- Customer creation and management
- Subscription lifecycle (create, update, cancel, pause)
- Usage record submission for metered billing
- Webhook event processing (payment succeeded, failed, subscription updated)
- Invoice generation and retrieval

**Plan Tiers**:
| Plan | Price | Projects | AI Requests/day | Storage | Support |
|------|-------|----------|-----------------|---------|---------|
| FREE | $0/mo | 1 | 100 | 500MB | Community |
| PRO | $29/mo | 10 | 1,000 | 5GB | Priority |
| TEAM | $79/mo | Unlimited | 10,000 | 50GB | Priority + SSO |
| ENTERPRISE | Custom | Unlimited | Unlimited | Custom | Dedicated + SLA |

**Usage Metering**: Resource consumption is tracked in-memory (batched) and flushed to the database every 60 seconds. The billing provider is notified of usage at the end of each billing period. Quota enforcement happens at the API layer using the rate limiting module, checking remaining quota before allowing requests.

**Quota Enforcement**: API guards check the user's current plan and consumed resources before processing requests. If a quota is exceeded, a 429 response with upgrade information is returned. Enforcement is performed using cached quota data (refreshed every 60 seconds) to avoid database queries on every request.

**Plan Changes**: Upgrades take effect immediately with prorated billing. Downgrades take effect at the end of the current billing period to avoid feature disruption.

## Consequences

### Positive

- **Provider flexibility**: Can switch from Stripe to another provider (or support multiple) without changing business logic
- **Clear separation**: Billing logic is isolated in its own module, not scattered across the application
- **Quota enforcement**: Users cannot exceed their plan limits, protecting infrastructure from abuse
- **Audit trail**: All billing events are recorded for compliance and debugging
- **Testability**: Adapter pattern enables mock implementations for testing without hitting real payment APIs

### Negative

- **Abstraction overhead**: The adapter layer adds indirection; some provider-specific features may not map cleanly to the interface
- **Complexity**: Supporting plan changes, proration, and usage metering across an abstraction boundary is non-trivial
- **Eventual consistency**: Usage metering is batched, so real-time accuracy has a 60-second window of drift
- **Feature lag**: New provider features require adapter updates before they can be exposed

### Mitigations

- The adapter interface is designed around common billing operations, with an escape hatch for provider-specific extensions
- Comprehensive integration tests validate adapter behavior against provider test environments
- Usage metering drift is acceptable for our use case (non-financial counters); hard limits use synchronous checks
- Enterprise customers with custom needs bypass the standard adapter through direct provider configuration
