export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export interface LoggerConfig {
  context: string;
  level?: LogLevel;
}

export interface MetricLabels {
  [key: string]: string;
}

export interface CounterMetric {
  type: 'counter';
  name: string;
  values: Map<string, number>;
}

export interface GaugeMetric {
  type: 'gauge';
  name: string;
  values: Map<string, number>;
}

export interface HistogramMetric {
  type: 'histogram';
  name: string;
  values: Map<string, { sum: number; count: number; buckets: Map<number, number> }>;
}

export type Metric = CounterMetric | GaugeMetric | HistogramMetric;

export interface CheckResult {
  name: string;
  status: 'up' | 'down';
  latency?: number;
  error?: string;
}

export interface HealthResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: CheckResult[];
  timestamp: string;
}

export type HealthCheckFn = () => Promise<{ status: 'up' | 'down'; latency?: number; error?: string }>;

export interface TraceHeaders {
  traceId: string;
  spanId: string;
  sampled: boolean;
}
