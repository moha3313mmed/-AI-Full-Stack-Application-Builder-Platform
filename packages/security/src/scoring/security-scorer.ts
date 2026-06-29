import {
  SecurityFinding,
  SecurityScore,
  SecurityScanType,
  SecuritySeverity,
} from '../types/index.js';

/**
 * Weight deductions per severity level.
 */
const SEVERITY_WEIGHTS: Record<SecuritySeverity, number> = {
  [SecuritySeverity.CRITICAL]: -25,
  [SecuritySeverity.HIGH]: -15,
  [SecuritySeverity.MEDIUM]: -8,
  [SecuritySeverity.LOW]: -3,
  [SecuritySeverity.INFO]: -1,
};

/**
 * SecurityScorer calculates security scores from scan findings.
 * The overall score starts at 100 and is reduced based on finding severity.
 * The minimum score is 0.
 */
export class SecurityScorer {
  /**
   * Calculate the overall security score from a list of findings.
   */
  calculateScore(findings: SecurityFinding[]): SecurityScore {
    const overall = this.calculateOverallScore(findings);
    const categories = this.calculateCategoryScores(findings);

    return { overall, categories };
  }

  /**
   * Calculate the overall score (0-100) from findings.
   */
  private calculateOverallScore(findings: SecurityFinding[]): number {
    let score = 100;

    for (const finding of findings) {
      score += SEVERITY_WEIGHTS[finding.severity];
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate per-category scores.
   */
  private calculateCategoryScores(findings: SecurityFinding[]): Record<SecurityScanType, number> {
    const categories: Record<SecurityScanType, number> = {
      [SecurityScanType.VULNERABILITY]: 100,
      [SecurityScanType.SECRET_DETECTION]: 100,
      [SecurityScanType.SQL_INJECTION]: 100,
      [SecurityScanType.XSS]: 100,
      [SecurityScanType.CSRF]: 100,
      [SecurityScanType.AUTH_REVIEW]: 100,
      [SecurityScanType.OWASP_FULL]: 100,
    };

    for (const finding of findings) {
      categories[finding.type] += SEVERITY_WEIGHTS[finding.severity];
    }

    // Ensure all scores are between 0 and 100
    for (const key of Object.keys(categories) as SecurityScanType[]) {
      categories[key] = Math.max(0, Math.min(100, categories[key]));
    }

    return categories;
  }

  /**
   * Get the severity weight for a given severity level.
   */
  getSeverityWeight(severity: SecuritySeverity): number {
    return SEVERITY_WEIGHTS[severity];
  }
}
