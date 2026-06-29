import type { VFSNode } from '@builder/codegen';
import { Injectable, Logger } from '@nestjs/common';

import { FilesService } from '../files/files.service';

/**
 * Result of running the validation pipeline on generated code.
 */
export interface ValidationResult {
  /** Whether validation passed */
  passed: boolean;
  /** List of validation issues found */
  issues: ValidationIssue[];
  /** Total number of files checked */
  filesChecked: number;
  /** Timestamp of validation run */
  timestamp: number;
}

export interface ValidationIssue {
  /** File path with the issue */
  path: string;
  /** Type of issue detected */
  type: 'empty_file' | 'invalid_json' | 'missing_import' | 'syntax_error';
  /** Human-readable description */
  message: string;
  /** Severity level */
  severity: 'error' | 'warning';
}

/**
 * ValidationPipeline runs a set of checks on generated code to ensure basic
 * correctness before accepting the changes.
 *
 * Checks performed:
 * - Non-empty files (files should have content)
 * - Valid JSON where expected (.json files)
 * - Import resolution (referenced files exist in the VFS)
 * - Basic syntax checks (brackets, quotes balance)
 */
@Injectable()
export class ValidationPipeline {
  private readonly logger = new Logger(ValidationPipeline.name);

  constructor(private readonly filesService: FilesService) {}

  /**
   * Validate generated files for a project.
   * @param projectId The project to validate
   * @param changedFiles List of file paths that were generated/modified
   * @returns ValidationResult with pass/fail and list of issues
   */
  validate(projectId: string, changedFiles: string[]): ValidationResult {
    const issues: ValidationIssue[] = [];
    let filesChecked = 0;

    for (const filePath of changedFiles) {
      try {
        const node = this.filesService.readFile(projectId, filePath);
        filesChecked++;

        // Check 1: Non-empty file content
        const emptyIssue = this.checkNonEmpty(node, filePath);
        if (emptyIssue) {
          issues.push(emptyIssue);
          continue; // Skip other checks if file is empty
        }

        const content = node.content?.text || '';

        // Check 2: Valid JSON for .json files
        if (filePath.endsWith('.json')) {
          const jsonIssue = this.checkValidJson(content, filePath);
          if (jsonIssue) {
            issues.push(jsonIssue);
          }
        }

        // Check 3: Import resolution
        const importIssues = this.checkImports(projectId, content, filePath);
        issues.push(...importIssues);

        // Check 4: Basic syntax balance check
        const syntaxIssue = this.checkSyntaxBalance(content, filePath);
        if (syntaxIssue) {
          issues.push(syntaxIssue);
        }
      } catch (error) {
        // File could not be read - this is itself an issue
        this.logger.warn(`Validation: Could not read file ${filePath}: ${error}`);
        issues.push({
          path: filePath,
          type: 'empty_file',
          message: `File could not be read: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error',
        });
        filesChecked++;
      }
    }

    const errors = issues.filter((i) => i.severity === 'error');
    const passed = errors.length === 0;

    this.logger.log(
      `Validation complete: ${filesChecked} files checked, ${issues.length} issues (${errors.length} errors)`,
    );

    return {
      passed,
      issues,
      filesChecked,
      timestamp: Date.now(),
    };
  }

  /**
   * Check that a file is not empty.
   */
  private checkNonEmpty(node: VFSNode, filePath: string): ValidationIssue | null {
    if (!node.content || !node.content.text || node.content.text.trim().length === 0) {
      return {
        path: filePath,
        type: 'empty_file',
        message: `File is empty or contains only whitespace`,
        severity: 'error',
      };
    }
    return null;
  }

  /**
   * Check that JSON files contain valid JSON.
   */
  private checkValidJson(content: string, filePath: string): ValidationIssue | null {
    try {
      JSON.parse(content);
      return null;
    } catch (error) {
      return {
        path: filePath,
        type: 'invalid_json',
        message: `Invalid JSON: ${error instanceof Error ? error.message : 'parse error'}`,
        severity: 'error',
      };
    }
  }

  /**
   * Check that relative imports reference files that exist in the VFS.
   * Skips path aliases (e.g., @/components, @builder/core) as they are
   * resolved by bundlers/TypeScript at build time, not by file path.
   */
  private checkImports(
    projectId: string,
    content: string,
    filePath: string,
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Match ES module imports: import ... from './path' or import ... from '../path'
    const importRegex = /(?:import|export)\s+.*?from\s+['"](\.[^'"]+)['"]/g;
    // Match require calls: require('./path')
    const requireRegex = /require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;

    const relativeImports: string[] = [];

    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      relativeImports.push(match[1]);
    }
    while ((match = requireRegex.exec(content)) !== null) {
      relativeImports.push(match[1]);
    }

    for (const importPath of relativeImports) {
      // Skip path aliases (e.g., @/components, @builder/core, @app/utils)
      // These start with @ and are resolved by bundlers/TypeScript path mapping
      if (importPath.startsWith('@')) {
        continue;
      }

      const resolved = this.resolveImportPath(filePath, importPath);
      if (!this.fileExistsInVFS(projectId, resolved)) {
        issues.push({
          path: filePath,
          type: 'missing_import',
          message: `Import "${importPath}" resolves to "${resolved}" which does not exist in the project`,
          severity: 'warning',
        });
      }
    }

    return issues;
  }

  /**
   * Check basic syntax balance (brackets, braces, quotes).
   */
  private checkSyntaxBalance(content: string, filePath: string): ValidationIssue | null {
    // Skip non-code files
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss'];
    if (!codeExtensions.some((ext) => filePath.endsWith(ext))) {
      return null;
    }

    let braces = 0;
    let brackets = 0;
    let parens = 0;
    let inString = false;
    let stringChar = '';
    let inTemplate = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const prev = i > 0 ? content[i - 1] : '';

      // Handle newlines
      if (char === '\n') {
        inLineComment = false;
        continue;
      }

      // Handle block comment end
      if (inBlockComment) {
        if (char === '/' && prev === '*') {
          inBlockComment = false;
        }
        continue;
      }

      // Handle line comments
      if (inLineComment) {
        continue;
      }

      // Detect comment start
      if (!inString && !inTemplate && char === '/' && content[i + 1] === '/') {
        inLineComment = true;
        continue;
      }
      if (!inString && !inTemplate && char === '/' && content[i + 1] === '*') {
        inBlockComment = true;
        continue;
      }

      // Handle strings
      if (inString) {
        if (char === stringChar && prev !== '\\') {
          inString = false;
        }
        continue;
      }

      if (inTemplate) {
        if (char === '`' && prev !== '\\') {
          inTemplate = false;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        continue;
      }

      if (char === '`') {
        inTemplate = true;
        continue;
      }

      // Count brackets
      if (char === '{') braces++;
      else if (char === '}') braces--;
      else if (char === '[') brackets++;
      else if (char === ']') brackets--;
      else if (char === '(') parens++;
      else if (char === ')') parens--;
    }

    if (braces !== 0 || brackets !== 0 || parens !== 0) {
      const unbalanced: string[] = [];
      if (braces !== 0) unbalanced.push(`braces (${braces > 0 ? 'missing }' : 'extra }'})`);
      if (brackets !== 0) unbalanced.push(`brackets (${brackets > 0 ? 'missing ]' : 'extra ]'})`);
      if (parens !== 0) unbalanced.push(`parentheses (${parens > 0 ? 'missing )' : 'extra )'})`);

      return {
        path: filePath,
        type: 'syntax_error',
        message: `Unbalanced ${unbalanced.join(', ')}`,
        severity: 'warning',
      };
    }

    return null;
  }

  /**
   * Resolve a relative import path from a file's directory.
   */
  private resolveImportPath(fromFile: string, importPath: string): string {
    const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
    const segments = fromDir.split('/').filter(Boolean);
    const importSegments = importPath.split('/');

    for (const seg of importSegments) {
      if (seg === '.') {
        continue;
      } else if (seg === '..') {
        segments.pop();
      } else {
        segments.push(seg);
      }
    }

    return '/' + segments.join('/');
  }

  /**
   * Check if a file exists in the VFS, trying common extensions.
   */
  private fileExistsInVFS(projectId: string, resolvedPath: string): boolean {
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

    for (const ext of extensions) {
      try {
        this.filesService.readFile(projectId, resolvedPath + ext);
        return true;
      } catch {
        // File not found with this extension, try next
      }
    }

    return false;
  }
}
