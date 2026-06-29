// @builder/security - Type Definitions

// ============================================================================
// Enums
// ============================================================================

/**
 * Types of security scans that can be performed.
 */
export enum SecurityScanType {
  VULNERABILITY = 'VULNERABILITY',
  SECRET_DETECTION = 'SECRET_DETECTION',
  SQL_INJECTION = 'SQL_INJECTION',
  XSS = 'XSS',
  CSRF = 'CSRF',
  AUTH_REVIEW = 'AUTH_REVIEW',
  OWASP_FULL = 'OWASP_FULL',
}

/**
 * Severity levels for security findings.
 */
export enum SecuritySeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO',
}

/**
 * Status of a security scan.
 */
export enum ScanStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Represents a single security finding discovered during a scan.
 */
export interface SecurityFinding {
  id: string;
  type: SecurityScanType;
  severity: SecuritySeverity;
  title: string;
  description: string;
  filePath: string;
  lineNumber: number;
  column?: number;
  snippet?: string;
  recommendation: string;
  cweId?: string;
  owaspCategory?: string;
}

/**
 * Configuration for running a security scan.
 */
export interface SecurityScanConfig {
  scanTypes?: SecurityScanType[];
  excludePatterns?: string[];
  severityThreshold?: SecuritySeverity;
  maxFindings?: number;
  customPatterns?: Record<string, RegExp[]>;
}

/**
 * Result of a completed security scan.
 */
export interface SecurityScanResult {
  id: string;
  projectId: string;
  scanType: SecurityScanType[];
  findings: SecurityFinding[];
  score: SecurityScore;
  startedAt: Date;
  completedAt: Date;
  status: ScanStatus;
  /** Errors encountered during scanning. Present when one or more scanners failed. */
  errors: string[];
}

/**
 * Security score breakdown.
 */
export interface SecurityScore {
  overall: number;
  categories: Record<SecurityScanType, number>;
}

/**
 * A file to be scanned.
 */
export interface ScanFile {
  path: string;
  content: string;
}
