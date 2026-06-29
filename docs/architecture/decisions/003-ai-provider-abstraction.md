# ADR 003: AI Provider Abstraction Layer

## Status

Accepted

## Context

The platform relies heavily on Large Language Model (LLM) capabilities for code generation, planning, and review. The AI landscape is rapidly evolving, with new models and providers emerging frequently. Each provider has different:

- API formats and authentication mechanisms
- Model capabilities (context window, code quality, reasoning)
- Pricing structures
- Rate limits and availability guarantees
- Streaming implementations

We need a strategy that avoids vendor lock-in while enabling us to use the best model for each task type.

The main options considered were:

1. **Direct OpenAI integration**: Use OpenAI exclusively
2. **LangChain/LlamaIndex**: Use an existing orchestration framework
3. **Custom abstraction layer**: Build our own provider interface
4. **Vercel AI SDK**: Use the Vercel AI SDK for provider switching

## Decision

We will implement a **custom AI provider abstraction layer** (`@builder/ai-core`) that defines a unified interface for AI completions, with pluggable provider implementations.

The abstraction provides:

```typescript
interface IAIProvider {
  complete(options: AICompletionOptions): Promise<AICompletionResponse>;
  stream(options: AICompletionOptions): AsyncGenerator<AIStreamChunk>;
  isAvailable(): Promise<boolean>;
}
```

Supported providers (initial):
- **OpenAI**: GPT-4o for complex reasoning, GPT-4o-mini for simpler tasks
- **Anthropic**: Claude 3.5 Sonnet for code generation (strong at code)
- **Google**: Gemini Pro for large-context operations

Provider selection is configurable per agent role and task type, with automatic failover.

## Consequences

### Positive

- **No vendor lock-in**: Can switch providers or add new ones without changing application code
- **Best-model-for-task**: Different agents can use different models optimized for their function (e.g., Claude for coding, GPT-4 for planning)
- **Cost optimization**: Can route simple tasks to cheaper models automatically
- **Resilience**: Automatic failover if one provider experiences downtime
- **Testing**: Easy to mock for unit testing with a simple interface
- **Future-proof**: New providers (Mistral, Llama, etc.) can be added as plugins

### Negative

- **Maintenance burden**: Must implement and maintain adapters for each provider
- **Lowest common denominator**: May not fully leverage provider-specific features (function calling variations, tool use patterns)
- **Version management**: Must track API changes across multiple providers
- **Complexity**: Additional abstraction layer adds code and potential bugs

### Mitigations

- Provider-specific extensions can be passed through the options object for advanced features
- Automated tests verify provider compatibility on a regular basis
- Token counting and cost tracking are standardized across providers
- Provider health checks enable proactive failover before user-facing errors
- Start with two providers (OpenAI + Anthropic), add others based on actual needs
