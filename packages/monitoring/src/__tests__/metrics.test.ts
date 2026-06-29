import { describe, it, expect, beforeEach } from 'vitest';

import { MetricsCollector } from '../metrics';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('increment', () => {
    it('should increment a counter', () => {
      collector.increment('http_requests_total');
      collector.increment('http_requests_total');
      collector.increment('http_requests_total');

      const metrics = collector.getMetrics();
      expect(metrics).toContain('http_requests_total 3');
    });

    it('should support labels', () => {
      collector.increment('http_requests_total', { method: 'GET', path: '/api' });
      collector.increment('http_requests_total', { method: 'POST', path: '/api' });
      collector.increment('http_requests_total', { method: 'GET', path: '/api' });

      const metrics = collector.getMetrics();
      expect(metrics).toContain('http_requests_total{method="GET",path="/api"} 2');
      expect(metrics).toContain('http_requests_total{method="POST",path="/api"} 1');
    });

    it('should track different counters independently', () => {
      collector.increment('counter_a');
      collector.increment('counter_b');
      collector.increment('counter_b');

      const metrics = collector.getMetrics();
      expect(metrics).toContain('counter_a 1');
      expect(metrics).toContain('counter_b 2');
    });
  });

  describe('decrement', () => {
    it('should decrement a counter', () => {
      collector.increment('connections');
      collector.increment('connections');
      collector.decrement('connections');

      const metrics = collector.getMetrics();
      expect(metrics).toContain('connections 1');
    });

    it('should allow negative values', () => {
      collector.decrement('test_counter');

      const metrics = collector.getMetrics();
      expect(metrics).toContain('test_counter -1');
    });
  });

  describe('gauge', () => {
    it('should set a gauge value', () => {
      collector.gauge('cpu_usage', 75.5);

      const metrics = collector.getMetrics();
      expect(metrics).toContain('cpu_usage 75.5');
    });

    it('should overwrite previous gauge value', () => {
      collector.gauge('memory_usage', 50);
      collector.gauge('memory_usage', 80);

      const metrics = collector.getMetrics();
      expect(metrics).toContain('memory_usage 80');
      expect(metrics).not.toContain('memory_usage 50');
    });

    it('should support labels on gauges', () => {
      collector.gauge('temperature', 22, { location: 'server_room' });
      collector.gauge('temperature', 35, { location: 'outdoors' });

      const metrics = collector.getMetrics();
      expect(metrics).toContain('temperature{location="server_room"} 22');
      expect(metrics).toContain('temperature{location="outdoors"} 35');
    });
  });

  describe('histogram', () => {
    it('should record histogram values', () => {
      collector.histogram('request_duration_seconds', 0.1);
      collector.histogram('request_duration_seconds', 0.25);
      collector.histogram('request_duration_seconds', 0.5);

      const metrics = collector.getMetrics();
      expect(metrics).toContain('# TYPE request_duration_seconds histogram');
      expect(metrics).toContain('request_duration_seconds_sum 0.85');
      expect(metrics).toContain('request_duration_seconds_count 3');
    });

    it('should generate bucket lines', () => {
      collector.histogram('latency', 0.05);
      collector.histogram('latency', 0.15);
      collector.histogram('latency', 2);

      const metrics = collector.getMetrics();
      expect(metrics).toContain('latency_bucket{le="0.05"} 1');
      expect(metrics).toContain('latency_bucket{le="0.25"} 2');
      expect(metrics).toContain('latency_bucket{le="2.5"} 3');
      expect(metrics).toContain('latency_bucket{le="+Inf"} 3');
    });

    it('should support labels on histograms', () => {
      collector.histogram('request_duration', 0.1, { method: 'GET' });
      collector.histogram('request_duration', 0.5, { method: 'POST' });

      const metrics = collector.getMetrics();
      expect(metrics).toContain('request_duration_sum{method="GET"} 0.1');
      expect(metrics).toContain('request_duration_sum{method="POST"} 0.5');
    });
  });

  describe('timing', () => {
    it('should record timing in seconds from milliseconds', () => {
      collector.timing('handler_duration', 150); // 150ms -> 0.15s

      const metrics = collector.getMetrics();
      expect(metrics).toContain('handler_duration_sum 0.15');
      expect(metrics).toContain('handler_duration_count 1');
    });

    it('should support labels on timing', () => {
      collector.timing('api_latency', 200, { endpoint: '/users' });

      const metrics = collector.getMetrics();
      expect(metrics).toContain('api_latency_sum{endpoint="/users"} 0.2');
    });
  });

  describe('getMetrics', () => {
    it('should include type annotations', () => {
      collector.increment('counter_metric');
      collector.gauge('gauge_metric', 5);
      collector.histogram('histogram_metric', 1);

      const metrics = collector.getMetrics();
      expect(metrics).toContain('# TYPE counter_metric counter');
      expect(metrics).toContain('# TYPE gauge_metric gauge');
      expect(metrics).toContain('# TYPE histogram_metric histogram');
    });

    it('should include help comments', () => {
      collector.increment('my_counter');

      const metrics = collector.getMetrics();
      expect(metrics).toContain('# HELP my_counter');
    });

    it('should return empty string when no metrics', () => {
      const metrics = collector.getMetrics();
      expect(metrics).toBe('');
    });
  });

  describe('resetMetrics', () => {
    it('should clear all metrics', () => {
      collector.increment('counter');
      collector.gauge('gauge', 10);
      collector.histogram('hist', 1);

      collector.resetMetrics();

      const metrics = collector.getMetrics();
      expect(metrics).toBe('');
    });
  });
});
