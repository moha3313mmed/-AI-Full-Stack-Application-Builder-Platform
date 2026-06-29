/**
 * Handles runtime error reporting from preview applications.
 * Injects error boundary scripts and receives error reports.
 */

export interface RuntimeError {
  projectId: string;
  type: 'uncaught' | 'unhandled-rejection' | 'console-error';
  message: string;
  stack: string | null;
  filename: string | null;
  line: number | null;
  column: number | null;
  timestamp: number;
}

export interface ConsoleEntry {
  projectId: string;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: string[];
  timestamp: number;
}

/**
 * Script injected into preview HTML to catch runtime errors
 * and forward them back to the preview server.
 */
export const ERROR_BOUNDARY_SCRIPT = `
<script data-preview-error-boundary>
(function() {
  var projectId = window.__PREVIEW_PROJECT_ID__ || location.pathname.split('/')[2] || 'unknown';
  var reportUrl = '/preview/' + projectId + '/errors';

  // Catch uncaught errors
  window.addEventListener('error', function(event) {
    fetch(reportUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'uncaught',
        message: event.message || 'Unknown error',
        stack: event.error ? event.error.stack : null,
        filename: event.filename || null,
        line: event.lineno || null,
        column: event.colno || null,
        timestamp: Date.now()
      })
    }).catch(function() {});
  });

  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    var message = 'Unhandled Promise Rejection';
    var stack = null;
    if (event.reason) {
      message = event.reason.message || String(event.reason);
      stack = event.reason.stack || null;
    }
    fetch(reportUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'unhandled-rejection',
        message: message,
        stack: stack,
        filename: null,
        line: null,
        column: null,
        timestamp: Date.now()
      })
    }).catch(function() {});
  });
})();
</script>
`;

/**
 * Script injected to intercept console output and forward it
 * to the preview server.
 */
export const CONSOLE_INTERCEPTOR_SCRIPT = `
<script data-preview-console-interceptor>
(function() {
  var projectId = window.__PREVIEW_PROJECT_ID__ || location.pathname.split('/')[2] || 'unknown';
  var consoleUrl = '/preview/' + projectId + '/console';
  var levels = ['log', 'warn', 'error', 'info', 'debug'];

  levels.forEach(function(level) {
    var original = console[level];
    console[level] = function() {
      // Call original
      original.apply(console, arguments);
      // Forward to server
      var args = Array.prototype.slice.call(arguments).map(function(arg) {
        try {
          return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
        } catch(e) {
          return '[unserializable]';
        }
      });
      fetch(consoleUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: level,
          args: args,
          timestamp: Date.now()
        })
      }).catch(function() {});
    };
  });
})();
</script>
`;

/**
 * Manages runtime error reports for preview projects.
 * Stores errors and console output, and broadcasts to listeners.
 */
export class RuntimeErrorReporter {
  private errors = new Map<string, RuntimeError[]>();
  private consoleEntries = new Map<string, ConsoleEntry[]>();
  private errorListeners: Array<(error: RuntimeError) => void> = [];
  private consoleListeners: Array<(entry: ConsoleEntry) => void> = [];
  private maxErrorsPerProject = 100;
  private maxConsolePerProject = 500;

  /**
   * Report a runtime error from a preview application.
   */
  reportError(projectId: string, report: Omit<RuntimeError, 'projectId'>): RuntimeError {
    const error: RuntimeError = {
      projectId,
      ...report,
    };

    if (!this.errors.has(projectId)) {
      this.errors.set(projectId, []);
    }

    const projectErrors = this.errors.get(projectId)!;
    projectErrors.push(error);

    // Trim to max
    if (projectErrors.length > this.maxErrorsPerProject) {
      projectErrors.shift();
    }

    // Notify listeners
    for (const listener of this.errorListeners) {
      listener(error);
    }

    return error;
  }

  /**
   * Report a console entry from a preview application.
   */
  reportConsole(projectId: string, entry: Omit<ConsoleEntry, 'projectId'>): ConsoleEntry {
    const consoleEntry: ConsoleEntry = {
      projectId,
      ...entry,
    };

    if (!this.consoleEntries.has(projectId)) {
      this.consoleEntries.set(projectId, []);
    }

    const projectConsole = this.consoleEntries.get(projectId)!;
    projectConsole.push(consoleEntry);

    // Trim to max
    if (projectConsole.length > this.maxConsolePerProject) {
      projectConsole.shift();
    }

    // Notify listeners
    for (const listener of this.consoleListeners) {
      listener(consoleEntry);
    }

    return consoleEntry;
  }

  /**
   * Get all errors for a project.
   */
  getErrors(projectId: string): RuntimeError[] {
    return this.errors.get(projectId) || [];
  }

  /**
   * Get all console entries for a project.
   */
  getConsoleEntries(projectId: string): ConsoleEntry[] {
    return this.consoleEntries.get(projectId) || [];
  }

  /**
   * Subscribe to runtime error events.
   */
  onError(listener: (error: RuntimeError) => void): () => void {
    this.errorListeners.push(listener);
    return () => {
      const idx = this.errorListeners.indexOf(listener);
      if (idx >= 0) this.errorListeners.splice(idx, 1);
    };
  }

  /**
   * Subscribe to console entry events.
   */
  onConsole(listener: (entry: ConsoleEntry) => void): () => void {
    this.consoleListeners.push(listener);
    return () => {
      const idx = this.consoleListeners.indexOf(listener);
      if (idx >= 0) this.consoleListeners.splice(idx, 1);
    };
  }

  /**
   * Clear all errors and console entries for a project.
   */
  clearProject(projectId: string): void {
    this.errors.delete(projectId);
    this.consoleEntries.delete(projectId);
  }

  /**
   * Clear all stored data.
   */
  clearAll(): void {
    this.errors.clear();
    this.consoleEntries.clear();
  }
}

/**
 * Inject error boundary and console interceptor scripts into HTML.
 * Should be called after the hot-reload script injection.
 */
export function injectErrorBoundary(html: string): string {
  const scripts = ERROR_BOUNDARY_SCRIPT + CONSOLE_INTERCEPTOR_SCRIPT;

  // Try to inject before </body>
  const bodyCloseIndex = html.lastIndexOf('</body>');
  if (bodyCloseIndex !== -1) {
    return html.slice(0, bodyCloseIndex) + scripts + html.slice(bodyCloseIndex);
  }

  // Try to inject before </html>
  const htmlCloseIndex = html.lastIndexOf('</html>');
  if (htmlCloseIndex !== -1) {
    return html.slice(0, htmlCloseIndex) + scripts + html.slice(htmlCloseIndex);
  }

  // Append to end if no closing tags found
  return html + scripts;
}
