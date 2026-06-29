# ADR 007: Code Generation Engine with AI and Template Scaffolding

## Status

Accepted

## Context

The AI Builder Platform generates source code for user projects based on natural language descriptions. The system must support both full project scaffolding (creating an entire project from a framework template) and incremental AI-driven generation (adding features, modifying existing code, refactoring). Requirements include:

- Generate complete project structures for supported frameworks (Next.js, React, Express, NestJS)
- Accept natural language descriptions and produce valid, runnable code
- Modify existing files while preserving surrounding code
- Integrate with the multi-agent system from `@builder/agent-system`
- Produce output compatible with the Virtual File System (`FileOperation` objects)
- Support multiple AI providers through `@builder/ai-core`

Options considered:
- **Template-only generation**: Use predefined templates with variable substitution (Yeoman-style)
- **AI-only generation**: Send all generation requests to an LLM without any templates
- **Hybrid approach**: Template scaffolding for project structure + AI generation for custom code
- **AST manipulation**: Parse code into an AST, transform programmatically, regenerate

## Decision

We will use a **hybrid approach** combining template-based scaffolding with AI-powered code generation, implemented in the `@builder/codegen` package (`packages/codegen/src/codegen/`). The system uses three cooperating components:

### Core Components

1. **`TemplateEngine`** (`src/codegen/template-engine.ts`): Generates initial project file trees for supported frameworks. Produces an array of `FileOperation[]` with type `create` for each file. Supports `nextjs`, `react`, `express`, and `nestjs` frameworks. Each scaffolder creates framework-appropriate configuration files (`package.json`, `tsconfig.json`, entry points, etc.) with sensible defaults.

2. **`CodeGenerator`** (`src/codegen/code-generator.ts`): Handles AI-powered code generation and modification through `@builder/ai-core` providers. Exposes three operations:
   - `generateCode(request, provider)` - Create new code from a description
   - `modifyCode(request, existingCode, provider)` - Alter existing files based on instructions
   - `refactorCode(request, existingCode, provider)` - Restructure code while preserving behavior

   All operations return a `CodeGenResult` containing `FileOperation[]`, an explanation string, and a success flag.

3. **`PromptBuilder`** (`src/codegen/prompt-builder.ts`): Constructs structured prompts for the AI provider. Builds context-aware prompts that include:
   - The user's description/request
   - Framework-specific guidelines and conventions
   - Existing file contents for modification context
   - Output format instructions (JSON `FileOperation` array)
   - Language-specific rules (TypeScript vs JavaScript)

### Generation Flow

```
User Request
    |
    v
PromptBuilder (constructs structured prompt)
    |
    v
AIProvider (from @builder/ai-core, e.g., Bedrock/Claude)
    |
    v
CodeGenerator (parses response into FileOperations)
    |
    v
FileOperation[] applied to VirtualFileSystem
```

### Integration with Agent System

The code generation engine is consumed by the backend codegen module (`apps/api/src/modules/codegen/`), which exposes REST endpoints for triggering generation. The agent system's specialized agents (e.g., `FrontendAgent`) delegate to the codegen service when they need to produce or modify files.

### Request and Result Types

```typescript
interface CodeGenRequest {
  description: string;
  framework?: Framework;      // 'nextjs' | 'react' | 'express' | 'nestjs'
  language?: Language;         // 'typescript' | 'javascript'
  filesContext?: FileContext[];
  model?: string;
  temperature?: number;
}

interface CodeGenResult {
  operations: FileOperation[];
  explanation: string;
  success: boolean;
  error?: string;
}
```

## Consequences

### Positive

- **Reliable structure**: Template scaffolding produces deterministic, well-formed project skeletons without AI hallucination risk
- **Flexible customization**: AI generation handles the unbounded creative space of custom features and modifications
- **Unified output format**: Both templates and AI produce `FileOperation[]`, making them composable and interchangeable from the VFS perspective
- **Provider-agnostic**: The `CodeGenerator` accepts any `AIProvider` from `@builder/ai-core`, supporting multiple models and easy provider switching
- **Structured prompts**: The `PromptBuilder` ensures consistent, high-quality prompts with proper context, reducing generation failures
- **Graceful error handling**: Failed AI generations return structured errors rather than throwing, allowing the UI to display helpful messages
- **Extensible framework support**: Adding a new framework requires only a new scaffolder method in `TemplateEngine` and corresponding guidelines in `PromptBuilder`

### Negative

- **Template maintenance**: Each supported framework requires manual template updates as frameworks evolve (e.g., new Next.js versions)
- **AI output parsing**: LLM responses may not always conform to the expected JSON format, requiring robust parsing and fallback logic
- **Prompt engineering complexity**: Prompt quality directly impacts generation quality; prompts need ongoing tuning
- **Cost per generation**: Each AI generation request incurs provider costs (API calls to Bedrock/Claude)
- **Latency**: AI generation is inherently slower than template instantiation, introducing wait times for users

### Mitigations

- Templates are versioned alongside the codebase and updated as part of framework upgrade cycles
- The `CodeGenerator` includes response parsing with error recovery, returning partial results when possible
- The `PromptBuilder` encapsulates prompt engineering, centralizing tuning in one location
- Generation results are cached in the VFS via snapshots, avoiding redundant re-generation
- Streaming responses (via `@builder/ai-core` streaming support) will enable progressive UI updates during generation
- The `temperature` parameter in `CodeGenRequest` allows callers to trade creativity for determinism based on the task
