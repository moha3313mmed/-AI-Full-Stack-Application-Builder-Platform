import { describe, it, expect } from 'vitest';

import { TraceContext } from '../tracing';

describe('TraceContext', () => {
  describe('generateTraceId', () => {
    it('should generate a 32-character hex string', () => {
      const traceId = TraceContext.generateTraceId();
      expect(traceId).toHaveLength(32);
      expect(traceId).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should generate unique trace IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(TraceContext.generateTraceId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('generateSpanId', () => {
    it('should generate a 16-character hex string', () => {
      const spanId = TraceContext.generateSpanId();
      expect(spanId).toHaveLength(16);
      expect(spanId).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should generate unique span IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(TraceContext.generateSpanId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('extractFromHeaders', () => {
    it('should extract trace context from valid traceparent header', () => {
      const headers = {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      };

      const result = TraceContext.extractFromHeaders(headers);

      expect(result).not.toBeNull();
      expect(result!.traceId).toBe('0af7651916cd43dd8448eb211c80319c');
      expect(result!.spanId).toBe('b7ad6b7169203331');
      expect(result!.sampled).toBe(true);
    });

    it('should handle sampled=false (flags=00)', () => {
      const headers = {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-00',
      };

      const result = TraceContext.extractFromHeaders(headers);

      expect(result).not.toBeNull();
      expect(result!.sampled).toBe(false);
    });

    it('should return null when traceparent is missing', () => {
      const headers = { 'content-type': 'application/json' };

      const result = TraceContext.extractFromHeaders(headers);

      expect(result).toBeNull();
    });

    it('should return null for invalid traceparent format', () => {
      const headers = { traceparent: 'invalid-format' };

      const result = TraceContext.extractFromHeaders(headers);

      expect(result).toBeNull();
    });

    it('should return null for incorrect length trace ID', () => {
      const headers = {
        traceparent: '00-short-b7ad6b7169203331-01',
      };

      const result = TraceContext.extractFromHeaders(headers);

      expect(result).toBeNull();
    });

    it('should handle array-valued headers', () => {
      const headers = {
        traceparent: ['00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'],
      };

      const result = TraceContext.extractFromHeaders(headers);

      expect(result).not.toBeNull();
      expect(result!.traceId).toBe('0af7651916cd43dd8448eb211c80319c');
    });

    it('should return null for undefined traceparent', () => {
      const headers: Record<string, undefined> = { traceparent: undefined };

      const result = TraceContext.extractFromHeaders(headers);

      expect(result).toBeNull();
    });
  });

  describe('injectToHeaders', () => {
    it('should create traceparent header with sampled flag', () => {
      const traceId = '0af7651916cd43dd8448eb211c80319c';
      const spanId = 'b7ad6b7169203331';

      const headers = TraceContext.injectToHeaders(traceId, spanId, true);

      expect(headers.traceparent).toBe(
        '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      );
    });

    it('should create traceparent header without sampled flag', () => {
      const traceId = '0af7651916cd43dd8448eb211c80319c';
      const spanId = 'b7ad6b7169203331';

      const headers = TraceContext.injectToHeaders(traceId, spanId, false);

      expect(headers.traceparent).toBe(
        '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-00',
      );
    });

    it('should default sampled to true', () => {
      const traceId = '0af7651916cd43dd8448eb211c80319c';
      const spanId = 'b7ad6b7169203331';

      const headers = TraceContext.injectToHeaders(traceId, spanId);

      expect(headers.traceparent).toContain('-01');
    });

    it('should produce a value parseable by extractFromHeaders', () => {
      const traceId = TraceContext.generateTraceId();
      const spanId = TraceContext.generateSpanId();

      const headers = TraceContext.injectToHeaders(traceId, spanId, true);
      const extracted = TraceContext.extractFromHeaders(headers);

      expect(extracted).not.toBeNull();
      expect(extracted!.traceId).toBe(traceId);
      expect(extracted!.spanId).toBe(spanId);
      expect(extracted!.sampled).toBe(true);
    });
  });
});
