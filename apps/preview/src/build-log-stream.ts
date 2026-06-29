/**
 * Captures and manages build log output from child processes.
 * Provides buffering, broadcasting, and error pattern detection.
 */

export interface BuildError {
  file: string | null;
  line: number | null;
  column: number | null;
  message: string;
  severity: 'error' | 'warning';
}

export interface LogEntry {
  timestamp: number;
  stream: 'stdout' | 'stderr';
  line: string;
}

/**
 * Error patterns for common build tools.
 * Each pattern has a regex and extraction logic for structured error info.
 */
const ERROR_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
  extract: (match: RegExpMatchArray) => BuildError;
}> = [
  {
    // TypeScript errors: src/file.ts(10,5): error TS2304: Cannot find name 'x'
    name: 'typescript',
    pattern: /^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+TS\d+:\s*(.+)$/,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      message: match[5],
      severity: match[4] as 'error' | 'warning',
    }),
  },
  {
    // TypeScript errors (alternative): src/file.ts:10:5 - error TS2304: Cannot find name 'x'
    name: 'typescript-alt',
    pattern: /^(.+?):(\d+):(\d+)\s*-\s*(error|warning)\s+TS\d+:\s*(.+)$/,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      message: match[5],
      severity: match[4] as 'error' | 'warning',
    }),
  },
  {
    // ESLint/Webpack style: ./src/file.ts 10:5 error Something went wrong
    name: 'eslint-style',
    pattern: /^(.+?)\s+(\d+):(\d+)\s+(error|warning)\s+(.+)$/,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      message: match[5],
      severity: match[4] as 'error' | 'warning',
    }),
  },
  {
    // Module not found: Error: Can't resolve 'module' in '/path'
    name: 'module-not-found',
    pattern: /Module not found:\s*(?:Error:\s*)?(?:Can't resolve|Cannot find)\s+'([^']+)'/,
    extract: (match) => ({
      file: null,
      line: null,
      column: null,
      message: `Module not found: '${match[1]}'`,
      severity: 'error',
    }),
  },
  {
    // SyntaxError: /path/file.ts: Unexpected token (10:5)
    name: 'syntax-error',
    pattern: /SyntaxError:\s*(.+?):\s*(.+?)\s*\((\d+):(\d+)\)/,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[3], 10),
      column: parseInt(match[4], 10),
      message: `SyntaxError: ${match[2]}`,
      severity: 'error',
    }),
  },
  {
    // Generic error with file:line:col pattern
    name: 'generic-file-error',
    pattern: /^(?:ERROR|Error)\s+in\s+(.+?):(\d+):(\d+)/,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      message: 'Build error',
      severity: 'error',
    }),
  },
];

/**
 * Manages build log output for a project, providing buffering,
 * error detection, and broadcasting capabilities.
 */
export class BuildLogStream {
  private logs: LogEntry[] = [];
  private errors: BuildError[] = [];
  private listeners: Array<(entry: LogEntry) => void> = [];
  private errorListeners: Array<(error: BuildError) => void> = [];

  /**
   * Add a log line from the build process.
   */
  addLine(stream: 'stdout' | 'stderr', line: string): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      stream,
      line,
    };

    this.logs.push(entry);

    // Detect errors in the line
    const detectedError = this.detectError(line, stream);
    if (detectedError) {
      this.errors.push(detectedError);
      for (const listener of this.errorListeners) {
        listener(detectedError);
      }
    }

    // Notify listeners
    for (const listener of this.listeners) {
      listener(entry);
    }
  }

  /**
   * Subscribe to real-time log entries.
   */
  onLog(listener: (entry: LogEntry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  /**
   * Subscribe to detected build errors.
   */
  onError(listener: (error: BuildError) => void): () => void {
    this.errorListeners.push(listener);
    return () => {
      const idx = this.errorListeners.indexOf(listener);
      if (idx >= 0) this.errorListeners.splice(idx, 1);
    };
  }

  /**
   * Get all log entries.
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get the full log output as a string.
   */
  getFullOutput(): string {
    return this.logs.map((entry) => entry.line).join('\n');
  }

  /**
   * Get all detected build errors.
   */
  getErrors(): BuildError[] {
    return [...this.errors];
  }

  /**
   * Get the number of log entries.
   */
  getLineCount(): number {
    return this.logs.length;
  }

  /**
   * Clear all logs and errors.
   */
  clear(): void {
    this.logs = [];
    this.errors = [];
  }

  /**
   * Detect if a log line contains a known error pattern.
   */
  private detectError(line: string, stream: 'stdout' | 'stderr'): BuildError | null {
    for (const { pattern, extract } of ERROR_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        return extract(match);
      }
    }

    // If on stderr and looks like an error but doesn't match patterns
    if (stream === 'stderr' && /\b(error|ERR!)/i.test(line) && line.length > 10) {
      return {
        file: null,
        line: null,
        column: null,
        message: line.trim(),
        severity: 'error',
      };
    }

    return null;
  }
}
