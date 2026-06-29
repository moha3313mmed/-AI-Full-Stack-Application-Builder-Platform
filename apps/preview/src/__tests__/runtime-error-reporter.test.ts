import { describe, it, expect, beforeEach } from 'vitest';

import {
  RuntimeErrorReporter,
  injectErrorBoundary,
  type RuntimeError,
  type ConsoleEntry,
} from '../runtime-error-reporter';

describe('RuntimeErrorReporter', () => {
  let reporter: RuntimeErrorReporter;

  beforeEach(() => {
    reporter = new RuntimeErrorReporter();
  });

  describe('error reporting', () => {
    it('should store reported errors', () => {
      reporter.reportError('project-1', {
        type: 'uncaught',
        message: 'TypeError: x is not a function',
        stack: 'at App.tsx:10',
        filename: 'App.tsx',
        line: 10,
        column: 5,
        timestamp: 1000,
      });

      const errors = reporter.getErrors('project-1');
      expect(errors).toHaveLength(1);
      expect(errors[0].projectId).toBe('project-1');
      expect(errors[0].type).toBe('uncaught');
      expect(errors[0].message).toBe('TypeError: x is not a function');
      expect(errors[0].filename).toBe('App.tsx');
      expect(errors[0].line).toBe(10);
      expect(errors[0].column).toBe(5);
    });

    it('should store errors per project', () => {
      reporter.reportError('project-1', {
        type: 'uncaught',
        message: 'Error 1',
        stack: null,
        filename: null,
        line: null,
        column: null,
        timestamp: 1000,
      });

      reporter.reportError('project-2', {
        type: 'uncaught',
        message: 'Error 2',
        stack: null,
        filename: null,
        line: null,
        column: null,
        timestamp: 2000,
      });

      expect(reporter.getErrors('project-1')).toHaveLength(1);
      expect(reporter.getErrors('project-2')).toHaveLength(1);
      expect(reporter.getErrors('project-1')[0].message).toBe('Error 1');
      expect(reporter.getErrors('project-2')[0].message).toBe('Error 2');
    });

    it('should return empty array for projects with no errors', () => {
      expect(reporter.getErrors('unknown')).toEqual([]);
    });

    it('should notify error listeners', () => {
      const received: RuntimeError[] = [];
      reporter.onError((err) => received.push(err));

      reporter.reportError('project-1', {
        type: 'unhandled-rejection',
        message: 'Promise rejected',
        stack: null,
        filename: null,
        line: null,
        column: null,
        timestamp: 1000,
      });

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('unhandled-rejection');
    });

    it('should support unsubscribing from error listeners', () => {
      const received: RuntimeError[] = [];
      const unsub = reporter.onError((err) => received.push(err));

      reporter.reportError('p1', {
        type: 'uncaught',
        message: 'first',
        stack: null,
        filename: null,
        line: null,
        column: null,
        timestamp: 1000,
      });

      unsub();

      reporter.reportError('p1', {
        type: 'uncaught',
        message: 'second',
        stack: null,
        filename: null,
        line: null,
        column: null,
        timestamp: 2000,
      });

      expect(received).toHaveLength(1);
    });
  });

  describe('console reporting', () => {
    it('should store console entries', () => {
      reporter.reportConsole('project-1', {
        level: 'log',
        args: ['Hello', 'world'],
        timestamp: 1000,
      });

      const entries = reporter.getConsoleEntries('project-1');
      expect(entries).toHaveLength(1);
      expect(entries[0].projectId).toBe('project-1');
      expect(entries[0].level).toBe('log');
      expect(entries[0].args).toEqual(['Hello', 'world']);
    });

    it('should store different console levels', () => {
      reporter.reportConsole('project-1', { level: 'log', args: ['info'], timestamp: 1000 });
      reporter.reportConsole('project-1', { level: 'warn', args: ['warning'], timestamp: 2000 });
      reporter.reportConsole('project-1', { level: 'error', args: ['bad'], timestamp: 3000 });

      const entries = reporter.getConsoleEntries('project-1');
      expect(entries).toHaveLength(3);
      expect(entries[0].level).toBe('log');
      expect(entries[1].level).toBe('warn');
      expect(entries[2].level).toBe('error');
    });

    it('should notify console listeners', () => {
      const received: ConsoleEntry[] = [];
      reporter.onConsole((entry) => received.push(entry));

      reporter.reportConsole('project-1', {
        level: 'warn',
        args: ['deprecation warning'],
        timestamp: 1000,
      });

      expect(received).toHaveLength(1);
      expect(received[0].level).toBe('warn');
    });

    it('should support unsubscribing from console listeners', () => {
      const received: ConsoleEntry[] = [];
      const unsub = reporter.onConsole((entry) => received.push(entry));

      reporter.reportConsole('p1', { level: 'log', args: ['a'], timestamp: 1000 });
      unsub();
      reporter.reportConsole('p1', { level: 'log', args: ['b'], timestamp: 2000 });

      expect(received).toHaveLength(1);
    });

    it('should return empty array for projects with no console entries', () => {
      expect(reporter.getConsoleEntries('unknown')).toEqual([]);
    });
  });

  describe('cleanup', () => {
    it('should clear data for a specific project', () => {
      reporter.reportError('p1', {
        type: 'uncaught',
        message: 'err',
        stack: null,
        filename: null,
        line: null,
        column: null,
        timestamp: 1000,
      });
      reporter.reportConsole('p1', { level: 'log', args: ['x'], timestamp: 1000 });
      reporter.reportError('p2', {
        type: 'uncaught',
        message: 'other',
        stack: null,
        filename: null,
        line: null,
        column: null,
        timestamp: 1000,
      });

      reporter.clearProject('p1');

      expect(reporter.getErrors('p1')).toEqual([]);
      expect(reporter.getConsoleEntries('p1')).toEqual([]);
      expect(reporter.getErrors('p2')).toHaveLength(1);
    });

    it('should clear all data', () => {
      reporter.reportError('p1', {
        type: 'uncaught',
        message: 'err',
        stack: null,
        filename: null,
        line: null,
        column: null,
        timestamp: 1000,
      });
      reporter.reportConsole('p2', { level: 'log', args: ['x'], timestamp: 1000 });

      reporter.clearAll();

      expect(reporter.getErrors('p1')).toEqual([]);
      expect(reporter.getConsoleEntries('p2')).toEqual([]);
    });
  });
});

describe('injectErrorBoundary', () => {
  it('should inject scripts before </body>', () => {
    const html = '<html><body><h1>Hello</h1></body></html>';
    const result = injectErrorBoundary(html);

    expect(result).toContain('data-preview-error-boundary');
    expect(result).toContain('data-preview-console-interceptor');
    expect(result.indexOf('data-preview-error-boundary')).toBeLessThan(result.indexOf('</body>'));
  });

  it('should inject scripts before </html> if no </body>', () => {
    const html = '<html><h1>Hello</h1></html>';
    const result = injectErrorBoundary(html);

    expect(result).toContain('data-preview-error-boundary');
    expect(result.indexOf('data-preview-error-boundary')).toBeLessThan(result.indexOf('</html>'));
  });

  it('should append to end if no closing tags', () => {
    const html = '<h1>Hello</h1>';
    const result = injectErrorBoundary(html);

    expect(result).toContain('data-preview-error-boundary');
    expect(result.startsWith('<h1>Hello</h1>')).toBe(true);
  });

  it('should include error boundary script content', () => {
    const html = '<html><body></body></html>';
    const result = injectErrorBoundary(html);

    expect(result).toContain("window.addEventListener('error'");
    expect(result).toContain("window.addEventListener('unhandledrejection'");
  });

  it('should include console interceptor script content', () => {
    const html = '<html><body></body></html>';
    const result = injectErrorBoundary(html);

    expect(result).toContain('data-preview-console-interceptor');
    expect(result).toContain("console[level]");
  });
});
