import { describe, it, expect, beforeEach } from 'vitest';

import { ScanPipeline } from '../pipeline/scan-pipeline.js';
import { BaseSecurityScanner, ScanPattern } from '../scanners/base-scanner.js';
import { ScannerRegistry } from '../scanners/scanner-registry.js';
import { SecretScanner } from '../scanners/secret-scanner.js';
import { SqlInjectionScanner } from '../scanners/sql-injection-scanner.js';
import { VulnerabilityScanner } from '../scanners/vulnerability-scanner.js';
import {
  SecurityScanType,
  ScanStatus,
  ScanFile,
 SecurityFinding, SecurityScanConfig, SecuritySeverity } from '../types/index.js';

describe('ScanPipeline', () => {
  let registry: ScannerRegistry;
  let pipeline: ScanPipeline;

  beforeEach(() => {
    registry = new ScannerRegistry();
    registry.register(SecurityScanType.VULNERABILITY, () => new VulnerabilityScanner());
    registry.register(SecurityScanType.SECRET_DETECTION, () => new SecretScanner());
    registry.register(SecurityScanType.SQL_INJECTION, () => new SqlInjectionScanner());
    pipeline = new ScanPipeline(registry);
  });

  describe('full pipeline execution', () => {
    it('should run all registered scanners', async () => {
      const files: ScanFile[] = [{
        path: 'src/app.ts',
        content: 'const x = eval(input);\nconst key = "AKIAIOSFODNN7EXAMPLE";',
      }];

      const result = await pipeline.run('project-1', files);
      expect(result.status).toBe(ScanStatus.COMPLETED);
      expect(result.findings.length).toBeGreaterThanOrEqual(2);
      expect(result.projectId).toBe('project-1');
    });

    it('should compute a security score', async () => {
      const files: ScanFile[] = [{
        path: 'src/app.ts',
        content: 'eval(code);',
      }];

      const result = await pipeline.run('project-1', files);
      expect(result.score).toBeDefined();
      expect(result.score.overall).toBeLessThan(100);
      expect(result.score.categories).toBeDefined();
    });

    it('should return completed status on success', async () => {
      const files: ScanFile[] = [{
        path: 'src/safe.ts',
        content: 'const x = 1;',
      }];

      const result = await pipeline.run('project-1', files);
      expect(result.status).toBe(ScanStatus.COMPLETED);
    });

    it('should include scan timestamps', async () => {
      const files: ScanFile[] = [{
        path: 'src/app.ts',
        content: 'const x = 1;',
      }];

      const result = await pipeline.run('project-1', files);
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.completedAt.getTime()).toBeGreaterThanOrEqual(result.startedAt.getTime());
    });
  });

  describe('scanner failure handling', () => {
    it('should handle scanner failure gracefully', async () => {
      class FailingScanner extends BaseSecurityScanner {
        getName(): string { return 'FailingScanner'; }
        getSupportedPatterns(): ScanPattern[] { return []; }
        scan(_files: ScanFile[], _config?: SecurityScanConfig): SecurityFinding[] {
          throw new Error('Scanner crashed');
        }
      }

      registry.register(SecurityScanType.XSS, () => new FailingScanner());

      const files: ScanFile[] = [{
        path: 'src/app.ts',
        content: 'eval(code);',
      }];

      const result = await pipeline.run('project-1', files);
      // Pipeline should still complete with results from working scanners
      expect(result.status).toBe(ScanStatus.COMPLETED);
      expect(result.findings.length).toBeGreaterThanOrEqual(1);
    });

    it('should return FAILED status when all scanners fail and no findings', async () => {
      class FailScanner extends BaseSecurityScanner {
        getName(): string { return 'FailScanner'; }
        getSupportedPatterns(): ScanPattern[] { return []; }
        scan(_files: ScanFile[], _config?: SecurityScanConfig): SecurityFinding[] {
          throw new Error('Broken');
        }
      }

      const failRegistry = new ScannerRegistry();
      failRegistry.register(SecurityScanType.VULNERABILITY, () => new FailScanner());
      const failPipeline = new ScanPipeline(failRegistry);

      const files: ScanFile[] = [{ path: 'test.ts', content: 'const x = 1;' }];
      const result = await failPipeline.run('project-1', files, {
        scanTypes: [SecurityScanType.VULNERABILITY],
      });
      expect(result.status).toBe(ScanStatus.FAILED);
    });
  });

  describe('configuration options', () => {
    it('should respect scanTypes filter', async () => {
      const files: ScanFile[] = [{
        path: 'src/app.ts',
        content: 'eval(code);\nconst key = "AKIAIOSFODNN7EXAMPLE";',
      }];

      const result = await pipeline.run('project-1', files, {
        scanTypes: [SecurityScanType.VULNERABILITY],
      });

      expect(result.findings.every(f => f.type === SecurityScanType.VULNERABILITY)).toBe(true);
    });

    it('should respect maxFindings limit', async () => {
      const files: ScanFile[] = [{
        path: 'src/bad.ts',
        content: 'eval(a);\neval(b);\neval(c);\neval(d);\neval(e);',
      }];

      const result = await pipeline.run('project-1', files, {
        maxFindings: 2,
      });

      expect(result.findings.length).toBeLessThanOrEqual(2);
    });

    it('should respect severity threshold', async () => {
      const files: ScanFile[] = [{
        path: 'src/app.ts',
        content: 'eval(code);\nelement.innerHTML = data;',
      }];

      const result = await pipeline.run('project-1', files, {
        severityThreshold: SecuritySeverity.CRITICAL,
      });

      expect(result.findings.every(f => f.severity === 'CRITICAL')).toBe(true);
    });

    it('should respect excludePatterns', async () => {
      const files: ScanFile[] = [
        { path: 'src/app.ts', content: 'eval(code);' },
        { path: 'test/app.test.ts', content: 'eval(testCode);' },
      ];

      const result = await pipeline.run('project-1', files, {
        excludePatterns: ['test/'],
      });

      expect(result.findings.every(f => !f.filePath.includes('test/'))).toBe(true);
    });
  });

  describe('empty file handling', () => {
    it('should handle empty file array', async () => {
      const result = await pipeline.run('project-1', []);
      expect(result.status).toBe(ScanStatus.COMPLETED);
      expect(result.findings.length).toBe(0);
      expect(result.score.overall).toBe(100);
    });

    it('should handle files with empty content', async () => {
      const files: ScanFile[] = [{
        path: 'src/empty.ts',
        content: '',
      }];

      const result = await pipeline.run('project-1', files);
      expect(result.status).toBe(ScanStatus.COMPLETED);
      expect(result.findings.length).toBe(0);
    });
  });

  describe('aggregation', () => {
    it('should aggregate findings from multiple scanners', async () => {
      const files: ScanFile[] = [{
        path: 'src/mixed.ts',
        content: 'eval(input);\ndb.query("SELECT * FROM users WHERE id = " + id);',
      }];

      const result = await pipeline.run('project-1', files);
      const types = new Set(result.findings.map(f => f.type));
      expect(types.size).toBeGreaterThanOrEqual(2);
    });
  });
});
