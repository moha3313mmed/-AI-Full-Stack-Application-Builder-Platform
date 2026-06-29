import { SecurityFinding, SecurityScanConfig, ScanFile } from '../types/index.js';

/**
 * Pattern definition used by scanners for detection.
 */
export interface ScanPattern {
  name: string;
  pattern: RegExp;
  description: string;
}

/**
 * Abstract base class for security scanners.
 * Each concrete scanner (vulnerability, secret, etc.) must implement these methods.
 */
export abstract class BaseSecurityScanner {
  /**
   * Scan the provided files for security issues.
   * Returns an array of findings discovered during the scan.
   */
  abstract scan(files: ScanFile[], config?: SecurityScanConfig): SecurityFinding[];

  /**
   * Get the patterns this scanner supports for detection.
   */
  abstract getSupportedPatterns(): ScanPattern[];

  /**
   * Get the human-readable name of this scanner.
   */
  abstract getName(): string;
}
