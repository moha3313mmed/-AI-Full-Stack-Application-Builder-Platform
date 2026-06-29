import type { CheckResult, HealthResult, HealthCheckFn } from './types';

export class HealthChecker {
  private checks = new Map<string, HealthCheckFn>();

  registerCheck(name: string, checkFn: HealthCheckFn): void {
    this.checks.set(name, checkFn);
  }

  removeCheck(name: string): void {
    this.checks.delete(name);
  }

  getRegisteredChecks(): string[] {
    return Array.from(this.checks.keys());
  }

  async runAll(): Promise<HealthResult> {
    const results: CheckResult[] = [];

    for (const [name, checkFn] of this.checks) {
      const start = Date.now();
      try {
        const result = await checkFn();
        const latency = result.latency ?? (Date.now() - start);
        results.push({
          name,
          status: result.status,
          latency,
          ...(result.error && { error: result.error }),
        });
      } catch (error) {
        const latency = Date.now() - start;
        results.push({
          name,
          status: 'down',
          latency,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const status = this.determineOverallStatus(results);

    return {
      status,
      checks: results,
      timestamp: new Date().toISOString(),
    };
  }

  private determineOverallStatus(checks: CheckResult[]): 'healthy' | 'degraded' | 'unhealthy' {
    if (checks.length === 0) return 'healthy';

    const allUp = checks.every((c) => c.status === 'up');
    const allDown = checks.every((c) => c.status === 'down');

    if (allUp) return 'healthy';
    if (allDown) return 'unhealthy';
    return 'degraded';
  }
}
