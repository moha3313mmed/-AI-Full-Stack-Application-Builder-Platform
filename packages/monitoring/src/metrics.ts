import type { MetricLabels } from './types';

interface CounterEntry {
  value: number;
}

interface GaugeEntry {
  value: number;
}

interface HistogramEntry {
  sum: number;
  count: number;
  values: number[];
}

export class MetricsCollector {
  private counters = new Map<string, Map<string, CounterEntry>>();
  private gauges = new Map<string, Map<string, GaugeEntry>>();
  private histograms = new Map<string, Map<string, HistogramEntry>>();

  private readonly defaultBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

  increment(name: string, labels?: MetricLabels): void {
    const key = this.labelsToKey(labels);
    if (!this.counters.has(name)) {
      this.counters.set(name, new Map());
    }
    const entries = this.counters.get(name)!;
    const current = entries.get(key)?.value ?? 0;
    entries.set(key, { value: current + 1 });
  }

  decrement(name: string, labels?: MetricLabels): void {
    const key = this.labelsToKey(labels);
    if (!this.counters.has(name)) {
      this.counters.set(name, new Map());
    }
    const entries = this.counters.get(name)!;
    const current = entries.get(key)?.value ?? 0;
    entries.set(key, { value: current - 1 });
  }

  gauge(name: string, value: number, labels?: MetricLabels): void {
    const key = this.labelsToKey(labels);
    if (!this.gauges.has(name)) {
      this.gauges.set(name, new Map());
    }
    this.gauges.get(name)!.set(key, { value });
  }

  histogram(name: string, value: number, labels?: MetricLabels): void {
    const key = this.labelsToKey(labels);
    if (!this.histograms.has(name)) {
      this.histograms.set(name, new Map());
    }
    const entries = this.histograms.get(name)!;
    if (!entries.has(key)) {
      entries.set(key, { sum: 0, count: 0, values: [] });
    }
    const entry = entries.get(key)!;
    entry.sum += value;
    entry.count += 1;
    entry.values.push(value);
  }

  timing(name: string, durationMs: number, labels?: MetricLabels): void {
    this.histogram(name, durationMs / 1000, labels);
  }

  getMetrics(): string {
    const lines: string[] = [];

    // Counters
    for (const [name, entries] of this.counters) {
      lines.push(`# HELP ${name} Counter metric`);
      lines.push(`# TYPE ${name} counter`);
      for (const [labelKey, entry] of entries) {
        const labelStr = this.keyToLabelString(labelKey);
        lines.push(`${name}${labelStr} ${entry.value}`);
      }
    }

    // Gauges
    for (const [name, entries] of this.gauges) {
      lines.push(`# HELP ${name} Gauge metric`);
      lines.push(`# TYPE ${name} gauge`);
      for (const [labelKey, entry] of entries) {
        const labelStr = this.keyToLabelString(labelKey);
        lines.push(`${name}${labelStr} ${entry.value}`);
      }
    }

    // Histograms
    for (const [name, entries] of this.histograms) {
      lines.push(`# HELP ${name} Histogram metric`);
      lines.push(`# TYPE ${name} histogram`);
      for (const [labelKey, entry] of entries) {
        const labelStr = this.keyToLabelString(labelKey);
        for (const bucket of this.defaultBuckets) {
          const count = entry.values.filter((v) => v <= bucket).length;
          lines.push(`${name}_bucket${this.mergeLabelWithBucket(labelStr, bucket)} ${count}`);
        }
        lines.push(`${name}_bucket${this.mergeLabelWithBucket(labelStr, Infinity)} ${entry.count}`);
        lines.push(`${name}_sum${labelStr} ${entry.sum}`);
        lines.push(`${name}_count${labelStr} ${entry.count}`);
      }
    }

    return lines.join('\n');
  }

  resetMetrics(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  private labelsToKey(labels?: MetricLabels): string {
    if (!labels || Object.keys(labels).length === 0) return '';
    const sorted = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([k, v]) => `${k}="${v}"`).join(',');
  }

  private keyToLabelString(key: string): string {
    if (!key) return '';
    return `{${key}}`;
  }

  private mergeLabelWithBucket(labelStr: string, bucket: number): string {
    const le = bucket === Infinity ? '+Inf' : String(bucket);
    if (!labelStr) {
      return `{le="${le}"}`;
    }
    // Insert le into existing labels
    return `{${labelStr.slice(1, -1)},le="${le}"}`;
  }
}
