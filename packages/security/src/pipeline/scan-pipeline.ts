import { BaseSecurityScanner } from '../scanners/base-scanner.js';
import { ScannerRegistry } from '../scanners/scanner-registry.js';
import { SecurityScorer } from '../scoring/security-scorer.js';
import {
  SecurityFinding,
  SecurityScanConfig,
  SecurityScanResult,
  SecurityScore,
  ScanStatus,
  ScanFile,
} from '../types/index.js';

import { FileAnalyzer } from './file-analyzer.js';

/**
 * ScanPipeline orchestrates multiple security scanners, aggregates findings,
 * computes scores, and handles scanner errors gracefully.
 */
export class ScanPipeline {
  private readonly registry: ScannerRegistry;
  private readonly scorer: SecurityScorer;
  private readonly fileAnalyzer: FileAnalyzer;
  private scanCounter = 0;

  constructor(registry: ScannerRegistry) {
    this.registry = registry;
    this.scorer = new SecurityScorer();
    this.fileAnalyzer = new FileAnalyzer();
  }

  /**
   * Run the full scan pipeline on the provided files.
   * Executes all registered scanners (or those specified in config).
   * One scanner failure does not abort the whole pipeline.
   */
  async run(
    projectId: string,
    files: ScanFile[],
    config?: SecurityScanConfig,
  ): Promise<SecurityScanResult> {
    this.scanCounter++;
    const scanId = `scan-${this.scanCounter}-${Date.now()}`;
    const startedAt = new Date();

    // Determine which scan types to run
    const scanTypes = config?.scanTypes || this.registry.listAvailable();

    // Filter out binary files
    const analyzedFiles = this.fileAnalyzer.analyze(files);
    const scannable: ScanFile[] = analyzedFiles.map((f) => ({
      path: f.path,
      content: f.content,
    }));

    // Aggregate findings from all scanners
    const findings: SecurityFinding[] = [];
    const errors: string[] = [];

    for (const scanType of scanTypes) {
      try {
        if (!this.registry.has(scanType)) {
          continue;
        }

        const scanner: BaseSecurityScanner = this.registry.get(scanType);
        const scanFindings = scanner.scan(scannable, config);
        findings.push(...scanFindings);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Scanner ${scanType} failed: ${errorMessage}`);
      }
    }

    const completedAt = new Date();
    const score: SecurityScore = this.scorer.calculateScore(findings);
    const status = errors.length > 0 && findings.length === 0
      ? ScanStatus.FAILED
      : ScanStatus.COMPLETED;

    return {
      id: scanId,
      projectId,
      scanType: scanTypes,
      findings: this.applyConfig(findings, config),
      score,
      startedAt,
      completedAt,
      status,
      errors,
    };
  }

  /**
   * Apply configuration filters to findings.
   */
  private applyConfig(
    findings: SecurityFinding[],
    config?: SecurityScanConfig,
  ): SecurityFinding[] {
    let filtered = findings;

    // Apply max findings limit
    if (config?.maxFindings && filtered.length > config.maxFindings) {
      filtered = filtered.slice(0, config.maxFindings);
    }

    // Apply severity threshold
    if (config?.severityThreshold) {
      const severityOrder = [
        'CRITICAL',
        'HIGH',
        'MEDIUM',
        'LOW',
        'INFO',
      ];
      const thresholdIndex = severityOrder.indexOf(config.severityThreshold);
      filtered = filtered.filter((f) => {
        const findingIndex = severityOrder.indexOf(f.severity);
        return findingIndex <= thresholdIndex;
      });
    }

    // Apply exclude patterns
    if (config?.excludePatterns && config.excludePatterns.length > 0) {
      filtered = filtered.filter((f) => {
        return !config.excludePatterns!.some((pattern) =>
          f.filePath.includes(pattern),
        );
      });
    }

    return filtered;
  }
}
