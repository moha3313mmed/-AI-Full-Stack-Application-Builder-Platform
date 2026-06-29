import type { CodeGenRequest, FileContext } from './types.js';

// ============================================================================
// Prompt Builder - Structured prompts for AI code generation
// ============================================================================

/** Maximum allowed length for user-supplied description text. */
const MAX_DESCRIPTION_LENGTH = 4000;

/**
 * Sanitize user-supplied text to prevent prompt injection.
 * Strips control characters, trims to a max length, and wraps in delimiters.
 */
function sanitizeUserInput(input: string): string {
  // Remove control characters except newline and tab
  // eslint-disable-next-line no-control-regex
  const cleaned = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Truncate to maximum length
  const truncated = cleaned.length > MAX_DESCRIPTION_LENGTH
    ? cleaned.slice(0, MAX_DESCRIPTION_LENGTH) + '\n[truncated]'
    : cleaned;
  return truncated;
}

/**
 * Builds structured prompts for AI code generation requests.
 * Includes file context, framework conventions, and output format instructions.
 */
export class PromptBuilder {
  /**
   * Build a prompt for generating new code.
   */
  buildGenerationPrompt(request: CodeGenRequest): string {
    const parts: string[] = [];

    parts.push('You are an expert code generator. Generate code based on the following request.');
    parts.push('');
    parts.push(`## Request`);
    parts.push('<user_request>');
    parts.push(sanitizeUserInput(request.description));
    parts.push('</user_request>');
    parts.push('');

    if (request.framework) {
      parts.push(`## Framework`);
      parts.push(this.getFrameworkGuidelines(request.framework));
      parts.push('');
    }

    if (request.language) {
      parts.push(`## Language`);
      parts.push(`Write code in ${request.language}.`);
      parts.push('');
    }

    if (request.filesContext && request.filesContext.length > 0) {
      parts.push(`## Existing Files for Context`);
      parts.push(this.formatFileContext(request.filesContext));
      parts.push('');
    }

    parts.push(`## Output Format`);
    parts.push(this.getOutputFormatInstructions());

    return parts.join('\n');
  }

  /**
   * Build a prompt for modifying existing code.
   */
  buildModificationPrompt(request: CodeGenRequest, existingCode: FileContext[]): string {
    const parts: string[] = [];

    parts.push('You are an expert code modifier. Modify the existing code based on the following request.');
    parts.push('');
    parts.push(`## Modification Request`);
    parts.push('<user_request>');
    parts.push(sanitizeUserInput(request.description));
    parts.push('</user_request>');
    parts.push('');

    if (request.framework) {
      parts.push(`## Framework`);
      parts.push(this.getFrameworkGuidelines(request.framework));
      parts.push('');
    }

    parts.push(`## Existing Code to Modify`);
    parts.push(this.formatFileContext(existingCode));
    parts.push('');

    if (request.filesContext && request.filesContext.length > 0) {
      parts.push(`## Additional Context Files`);
      parts.push(this.formatFileContext(request.filesContext));
      parts.push('');
    }

    parts.push(`## Output Format`);
    parts.push(this.getOutputFormatInstructions());

    return parts.join('\n');
  }

  /**
   * Build a prompt for refactoring existing code.
   */
  buildRefactoringPrompt(request: CodeGenRequest, existingCode: FileContext[]): string {
    const parts: string[] = [];

    parts.push('You are an expert code refactorer. Refactor the following code while maintaining its functionality.');
    parts.push('');
    parts.push(`## Refactoring Goal`);
    parts.push('<user_request>');
    parts.push(sanitizeUserInput(request.description));
    parts.push('</user_request>');
    parts.push('');

    parts.push(`## Code to Refactor`);
    parts.push(this.formatFileContext(existingCode));
    parts.push('');

    if (request.framework) {
      parts.push(`## Framework Conventions`);
      parts.push(this.getFrameworkGuidelines(request.framework));
      parts.push('');
    }

    parts.push(`## Output Format`);
    parts.push(this.getOutputFormatInstructions());

    return parts.join('\n');
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private formatFileContext(files: FileContext[]): string {
    return files
      .map(
        (file) =>
          `### ${file.path}${file.language ? ` (${file.language})` : ''}\n\`\`\`${file.language || ''}\n${file.content}\n\`\`\``
      )
      .join('\n\n');
  }

  private getFrameworkGuidelines(framework: string): string {
    const guidelines: Record<string, string> = {
      nextjs:
        'Follow Next.js 14 App Router conventions. Use server components by default. Use "use client" directive for interactive components. Follow file-based routing patterns.',
      react:
        'Follow modern React patterns with functional components and hooks. Use proper component composition and state management.',
      express:
        'Follow Express.js best practices. Use middleware pattern. Implement proper error handling. Structure routes and controllers separately.',
      nestjs:
        'Follow NestJS conventions with modules, controllers, services, and DTOs. Use dependency injection. Apply decorators properly.',
    };

    return guidelines[framework] || `Follow ${framework} best practices and conventions.`;
  }

  private getOutputFormatInstructions(): string {
    return `Respond with a JSON object containing file operations. Each operation should have:
- "type": "create" | "update" | "delete"
- "path": file path starting with /
- "content": file content (for create/update)
- "language": programming language identifier

Example:
\`\`\`json
{
  "operations": [
    { "type": "create", "path": "/src/component.tsx", "content": "...", "language": "typescriptreact" },
    { "type": "update", "path": "/src/app.tsx", "content": "...", "language": "typescriptreact" }
  ],
  "explanation": "Brief explanation of changes made"
}
\`\`\`

Only output the JSON object, no additional text.`;
  }
}
