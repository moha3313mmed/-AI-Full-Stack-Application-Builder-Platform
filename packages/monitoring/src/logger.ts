import type { LogLevel, LogEntry, LoggerConfig } from './types';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class StructuredLogger {
  private readonly context: string;
  private level: LogLevel;
  private traceId?: string;

  constructor(config: LoggerConfig) {
    this.context = config.context;
    this.level = config.level ?? (process.env.LOG_LEVEL as LogLevel) ?? 'info';
  }

  setTraceId(traceId: string): void {
    this.traceId = traceId;
  }

  clearTraceId(): void {
    this.traceId = undefined;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  log(message: string, metadata?: Record<string, unknown>): void {
    this.writeLog('info', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.writeLog('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.writeLog('warn', message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.writeLog('error', message, metadata);
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.writeLog('debug', message, metadata);
  }

  private writeLog(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.level]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      ...(this.traceId && { traceId: this.traceId }),
      ...(metadata && Object.keys(metadata).length > 0 && { metadata }),
    };

    const output = JSON.stringify(entry);

    switch (level) {
      case 'error':
        process.stderr.write(output + '\n');
        break;
      case 'warn':
        process.stderr.write(output + '\n');
        break;
      default:
        process.stdout.write(output + '\n');
        break;
    }
  }
}

export function createLogger(context: string, level?: LogLevel): StructuredLogger {
  return new StructuredLogger({ context, level });
}
