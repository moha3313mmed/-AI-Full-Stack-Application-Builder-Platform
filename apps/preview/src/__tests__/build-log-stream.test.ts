import { describe, it, expect, beforeEach } from 'vitest';

import { BuildLogStream, type BuildError, type LogEntry } from '../build-log-stream';

describe('BuildLogStream', () => {
  let logStream: BuildLogStream;

  beforeEach(() => {
    logStream = new BuildLogStream();
  });

  describe('log capture', () => {
    it('should capture stdout lines', () => {
      logStream.addLine('stdout', 'Compiling...');
      logStream.addLine('stdout', 'Done.');

      const logs = logStream.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].stream).toBe('stdout');
      expect(logs[0].line).toBe('Compiling...');
      expect(logs[1].line).toBe('Done.');
    });

    it('should capture stderr lines', () => {
      logStream.addLine('stderr', 'Warning: deprecated');

      const logs = logStream.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].stream).toBe('stderr');
      expect(logs[0].line).toBe('Warning: deprecated');
    });

    it('should include timestamps in log entries', () => {
      const before = Date.now();
      logStream.addLine('stdout', 'test');
      const after = Date.now();

      const logs = logStream.getLogs();
      expect(logs[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(logs[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should return full output as string', () => {
      logStream.addLine('stdout', 'line 1');
      logStream.addLine('stderr', 'line 2');
      logStream.addLine('stdout', 'line 3');

      expect(logStream.getFullOutput()).toBe('line 1\nline 2\nline 3');
    });

    it('should report line count', () => {
      logStream.addLine('stdout', 'a');
      logStream.addLine('stdout', 'b');
      logStream.addLine('stderr', 'c');

      expect(logStream.getLineCount()).toBe(3);
    });

    it('should clear logs and errors', () => {
      logStream.addLine('stderr', 'src/file.ts(10,5): error TS2304: Cannot find name');
      expect(logStream.getLineCount()).toBe(1);
      expect(logStream.getErrors().length).toBe(1);

      logStream.clear();
      expect(logStream.getLineCount()).toBe(0);
      expect(logStream.getErrors().length).toBe(0);
    });
  });

  describe('error detection', () => {
    it('should detect TypeScript errors with parens format', () => {
      logStream.addLine('stderr', "src/app.ts(10,5): error TS2304: Cannot find name 'foo'");

      const errors = logStream.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].file).toBe('src/app.ts');
      expect(errors[0].line).toBe(10);
      expect(errors[0].column).toBe(5);
      expect(errors[0].message).toBe("Cannot find name 'foo'");
      expect(errors[0].severity).toBe('error');
    });

    it('should detect TypeScript errors with colon format', () => {
      logStream.addLine('stderr', "src/app.ts:15:3 - error TS7006: Parameter 'x' implicitly has an 'any' type");

      const errors = logStream.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].file).toBe('src/app.ts');
      expect(errors[0].line).toBe(15);
      expect(errors[0].column).toBe(3);
      expect(errors[0].message).toBe("Parameter 'x' implicitly has an 'any' type");
      expect(errors[0].severity).toBe('error');
    });

    it('should detect TypeScript warnings', () => {
      logStream.addLine('stderr', "src/util.ts(5,1): warning TS6133: 'x' is declared but never used");

      const errors = logStream.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('warning');
    });

    it('should detect module not found errors', () => {
      logStream.addLine('stderr', "Module not found: Error: Can't resolve 'react-router' in '/app/src'");

      const errors = logStream.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('react-router');
      expect(errors[0].severity).toBe('error');
    });

    it('should detect syntax errors', () => {
      logStream.addLine('stderr', 'SyntaxError: /app/src/index.ts: Unexpected token (5:10)');

      const errors = logStream.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].file).toBe('/app/src/index.ts');
      expect(errors[0].line).toBe(5);
      expect(errors[0].column).toBe(10);
      expect(errors[0].severity).toBe('error');
    });

    it('should detect eslint-style errors', () => {
      logStream.addLine('stdout', './src/App.tsx 10:5 error Unexpected console statement');

      const errors = logStream.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].file).toBe('./src/App.tsx');
      expect(errors[0].line).toBe(10);
      expect(errors[0].column).toBe(5);
      expect(errors[0].message).toBe('Unexpected console statement');
    });

    it('should detect generic error lines on stderr', () => {
      logStream.addLine('stderr', 'npm ERR! code ELIFECYCLE');

      const errors = logStream.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('ERR!');
      expect(errors[0].severity).toBe('error');
    });

    it('should not flag normal stdout as errors', () => {
      logStream.addLine('stdout', 'Compiling TypeScript...');
      logStream.addLine('stdout', 'Build complete in 2.3s');

      const errors = logStream.getErrors();
      expect(errors).toHaveLength(0);
    });
  });

  describe('listeners', () => {
    it('should notify log listeners for each line', () => {
      const received: LogEntry[] = [];
      logStream.onLog((entry) => received.push(entry));

      logStream.addLine('stdout', 'line 1');
      logStream.addLine('stderr', 'line 2');

      expect(received).toHaveLength(2);
      expect(received[0].line).toBe('line 1');
      expect(received[1].line).toBe('line 2');
    });

    it('should notify error listeners when errors detected', () => {
      const received: BuildError[] = [];
      logStream.onError((error) => received.push(error));

      logStream.addLine('stdout', 'normal line');
      logStream.addLine('stderr', "src/x.ts(1,1): error TS1005: ';' expected");

      expect(received).toHaveLength(1);
      expect(received[0].file).toBe('src/x.ts');
    });

    it('should support unsubscribing from listeners', () => {
      const received: LogEntry[] = [];
      const unsub = logStream.onLog((entry) => received.push(entry));

      logStream.addLine('stdout', 'before');
      unsub();
      logStream.addLine('stdout', 'after');

      expect(received).toHaveLength(1);
      expect(received[0].line).toBe('before');
    });

    it('should support unsubscribing from error listeners', () => {
      const received: BuildError[] = [];
      const unsub = logStream.onError((error) => received.push(error));

      logStream.addLine('stderr', "a.ts(1,1): error TS1: first");
      unsub();
      logStream.addLine('stderr', "b.ts(1,1): error TS2: second");

      expect(received).toHaveLength(1);
    });
  });
});
