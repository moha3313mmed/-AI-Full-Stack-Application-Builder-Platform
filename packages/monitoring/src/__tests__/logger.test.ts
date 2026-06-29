import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { StructuredLogger, createLogger } from '../logger';

describe('StructuredLogger', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stdoutSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stderrSpy: any;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('should create a logger with context', () => {
    const logger = new StructuredLogger({ context: 'TestService' });
    expect(logger).toBeDefined();
  });

  it('should output JSON format with required fields', () => {
    const logger = new StructuredLogger({ context: 'TestService', level: 'debug' });
    logger.info('Hello world');

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);

    expect(output.timestamp).toBeDefined();
    expect(output.level).toBe('info');
    expect(output.message).toBe('Hello world');
    expect(output.context).toBe('TestService');
  });

  it('should include traceId when set', () => {
    const logger = new StructuredLogger({ context: 'TestService', level: 'debug' });
    logger.setTraceId('abc123');
    logger.info('traced message');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.traceId).toBe('abc123');
  });

  it('should not include traceId after clearTraceId', () => {
    const logger = new StructuredLogger({ context: 'TestService', level: 'debug' });
    logger.setTraceId('abc123');
    logger.clearTraceId();
    logger.info('untraced message');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.traceId).toBeUndefined();
  });

  it('should include metadata when provided', () => {
    const logger = new StructuredLogger({ context: 'TestService', level: 'debug' });
    logger.info('with metadata', { userId: '123', action: 'login' });

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.metadata).toEqual({ userId: '123', action: 'login' });
  });

  it('should not include metadata field when no metadata provided', () => {
    const logger = new StructuredLogger({ context: 'TestService', level: 'debug' });
    logger.info('no metadata');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.metadata).toBeUndefined();
  });

  it('should respect log level - filter debug when level is info', () => {
    const logger = new StructuredLogger({ context: 'TestService', level: 'info' });
    logger.debug('should not appear');

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should respect log level - allow warn when level is info', () => {
    const logger = new StructuredLogger({ context: 'TestService', level: 'info' });
    logger.warn('warning message');

    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(stderrSpy.mock.calls[0][0] as string);
    expect(output.level).toBe('warn');
  });

  it('should write errors to stderr', () => {
    const logger = new StructuredLogger({ context: 'TestService', level: 'debug' });
    logger.error('error message');

    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(stderrSpy.mock.calls[0][0] as string);
    expect(output.level).toBe('error');
  });

  it('should write warnings to stderr', () => {
    const logger = new StructuredLogger({ context: 'TestService', level: 'debug' });
    logger.warn('warn message');

    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(stderrSpy.mock.calls[0][0] as string);
    expect(output.level).toBe('warn');
  });

  it('should write info and debug to stdout', () => {
    const logger = new StructuredLogger({ context: 'TestService', level: 'debug' });
    logger.info('info message');
    logger.debug('debug message');

    expect(stdoutSpy).toHaveBeenCalledTimes(2);
  });

  it('should allow changing log level at runtime', () => {
    const logger = new StructuredLogger({ context: 'TestService', level: 'error' });
    logger.info('should not appear');
    expect(stdoutSpy).not.toHaveBeenCalled();

    logger.setLevel('debug');
    logger.info('should appear');
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should report current level', () => {
    const logger = new StructuredLogger({ context: 'TestService', level: 'warn' });
    expect(logger.getLevel()).toBe('warn');
  });

  it('log() method should output at info level', () => {
    const logger = new StructuredLogger({ context: 'TestService', level: 'debug' });
    logger.log('generic log');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.level).toBe('info');
  });

  it('should output valid ISO timestamp', () => {
    const logger = new StructuredLogger({ context: 'TestService', level: 'debug' });
    logger.info('timestamp test');

    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    const parsed = new Date(output.timestamp);
    expect(parsed.toISOString()).toBe(output.timestamp);
  });
});

describe('createLogger', () => {
  it('should create a StructuredLogger with the given context', () => {
    const logger = createLogger('MyService');
    expect(logger).toBeInstanceOf(StructuredLogger);
  });

  it('should create a StructuredLogger with custom log level', () => {
    const logger = createLogger('MyService', 'error');
    expect(logger.getLevel()).toBe('error');
  });
});
