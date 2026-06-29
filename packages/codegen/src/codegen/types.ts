import type { FileOperation } from '../vfs/types.js';

// ============================================================================
// Code Generation Types
// ============================================================================

/**
 * Supported frameworks for project scaffolding.
 */
export type Framework = 'nextjs' | 'react' | 'express' | 'nestjs';

/**
 * Supported programming languages.
 */
export type Language = 'typescript' | 'javascript';

/**
 * Request for AI-powered code generation.
 */
export interface CodeGenRequest {
  /** Description of what to generate */
  description: string;
  /** Target framework */
  framework?: Framework;
  /** Target language */
  language?: Language;
  /** Existing files for context */
  filesContext?: FileContext[];
  /** Model to use for generation */
  model?: string;
  /** Temperature for generation (0-1) */
  temperature?: number;
}

/**
 * Context file provided to the AI for code generation.
 */
export interface FileContext {
  /** File path */
  path: string;
  /** File content */
  content: string;
  /** Language of the file */
  language?: string;
}

/**
 * Result of AI code generation.
 */
export interface CodeGenResult {
  /** File operations to apply */
  operations: FileOperation[];
  /** Human-readable explanation of changes */
  explanation: string;
  /** Whether the generation was successful */
  success: boolean;
  /** Error message if generation failed */
  error?: string;
}

/**
 * Configuration for project scaffolding templates.
 */
export interface TemplateConfig {
  /** Framework to scaffold */
  framework: Framework;
  /** Project name */
  name: string;
  /** Programming language */
  language: Language;
  /** Additional features to include */
  features?: string[];
}

/**
 * Configuration for scaffolding a new project.
 */
export interface ScaffoldConfig {
  /** Framework to use */
  framework: Framework;
  /** Project name */
  name: string;
  /** Language (default: typescript) */
  language?: Language;
  /** Include testing setup */
  includeTests?: boolean;
  /** Include linting configuration */
  includeLinting?: boolean;
  /** Package manager preference */
  packageManager?: 'npm' | 'pnpm' | 'yarn';
}
