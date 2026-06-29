// @builder/security - Security Scanning and Vulnerability Detection
//
// This package provides provider-agnostic security scanning with vulnerability
// detection, secret scanning, SQL injection detection, XSS detection, CSRF
// detection, authentication review, and OWASP compliance checking.

// ============================================================================
// Types
// ============================================================================

export {
  SecurityScanType,
  SecuritySeverity,
  ScanStatus,
  type SecurityFinding,
  type SecurityScanConfig,
  type SecurityScanResult,
  type SecurityScore,
  type ScanFile,
} from './types/index.js';

// ============================================================================
// Scanners
// ============================================================================

export { BaseSecurityScanner, type ScanPattern } from './scanners/base-scanner.js';
export { VulnerabilityScanner } from './scanners/vulnerability-scanner.js';
export { SecretScanner } from './scanners/secret-scanner.js';
export { SqlInjectionScanner } from './scanners/sql-injection-scanner.js';
export { XssScanner } from './scanners/xss-scanner.js';
export { CsrfScanner } from './scanners/csrf-scanner.js';
export { AuthScanner } from './scanners/auth-scanner.js';
export { ScannerRegistry, type ScannerFactory } from './scanners/scanner-registry.js';

// ============================================================================
// Scoring
// ============================================================================

export { SecurityScorer } from './scoring/security-scorer.js';

// ============================================================================
// Pipeline
// ============================================================================

export { ScanPipeline } from './pipeline/scan-pipeline.js';
export { FileAnalyzer, type AnalyzedFile, type FileType } from './pipeline/file-analyzer.js';

// ============================================================================
// OWASP
// ============================================================================

export { OWASP_TOP_10_RULES, type OwaspRule } from './owasp/owasp-rules.js';
