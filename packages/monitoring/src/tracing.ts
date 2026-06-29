import { randomBytes } from 'crypto';

import type { TraceHeaders } from './types';

const TRACEPARENT_HEADER = 'traceparent';
const TRACEPARENT_REGEX = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export class TraceContext {
  /**
   * Generate a 32-character hex trace ID.
   */
  static generateTraceId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Generate a 16-character hex span ID.
   */
  static generateSpanId(): string {
    return randomBytes(8).toString('hex');
  }

  /**
   * Extract trace context from HTTP headers using W3C Trace Context format.
   * Parses the 'traceparent' header: version-traceId-spanId-traceFlags
   */
  static extractFromHeaders(headers: Record<string, string | string[] | undefined>): TraceHeaders | null {
    const traceparent = headers[TRACEPARENT_HEADER];
    const value = Array.isArray(traceparent) ? traceparent[0] : traceparent;

    if (!value) return null;

    const match = value.match(TRACEPARENT_REGEX);
    if (!match) return null;

    const traceId = match[2];
    const spanId = match[3];
    const flags = parseInt(match[4], 16);
    const sampled = (flags & 0x01) === 1;

    return { traceId, spanId, sampled };
  }

  /**
   * Inject trace context into HTTP headers using W3C Trace Context format.
   * Generates the 'traceparent' header value.
   */
  static injectToHeaders(traceId: string, spanId: string, sampled = true): Record<string, string> {
    const flags = sampled ? '01' : '00';
    const traceparent = `00-${traceId}-${spanId}-${flags}`;

    return {
      [TRACEPARENT_HEADER]: traceparent,
    };
  }
}
