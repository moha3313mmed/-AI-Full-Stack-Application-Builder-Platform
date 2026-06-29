import { describe, it, expect, beforeEach } from 'vitest';

import { SecurityScorer } from '../scoring/security-scorer.js';
import {
  SecurityFinding,
  SecurityScanType,
  SecuritySeverity,
} from '../types/index.js';

function createFinding(
  severity: SecuritySeverity,
  type: SecurityScanType = SecurityScanType.VULNERABILITY,
): SecurityFinding {
  return {
    id: `TEST-${Math.random()}`,
    type,
    severity,
    title: 'Test finding',
    description: 'Test description',
    filePath: 'test.ts',
    lineNumber: 1,
    recommendation: 'Fix it',
  };
}

describe('SecurityScorer', () => {
  let scorer: SecurityScorer;

  beforeEach(() => {
    scorer = new SecurityScorer();
  });

  describe('calculateScore with no findings', () => {
    it('should return perfect score (100) when no findings', () => {
      const score = scorer.calculateScore([]);
      expect(score.overall).toBe(100);
    });

    it('should return 100 for all categories when no findings', () => {
      const score = scorer.calculateScore([]);
      Object.values(score.categories).forEach((categoryScore) => {
        expect(categoryScore).toBe(100);
      });
    });
  });

  describe('severity weight deductions', () => {
    it('should deduct 25 points for CRITICAL finding', () => {
      const findings = [createFinding(SecuritySeverity.CRITICAL)];
      const score = scorer.calculateScore(findings);
      expect(score.overall).toBe(75);
    });

    it('should deduct 15 points for HIGH finding', () => {
      const findings = [createFinding(SecuritySeverity.HIGH)];
      const score = scorer.calculateScore(findings);
      expect(score.overall).toBe(85);
    });

    it('should deduct 8 points for MEDIUM finding', () => {
      const findings = [createFinding(SecuritySeverity.MEDIUM)];
      const score = scorer.calculateScore(findings);
      expect(score.overall).toBe(92);
    });

    it('should deduct 3 points for LOW finding', () => {
      const findings = [createFinding(SecuritySeverity.LOW)];
      const score = scorer.calculateScore(findings);
      expect(score.overall).toBe(97);
    });

    it('should deduct 1 point for INFO finding', () => {
      const findings = [createFinding(SecuritySeverity.INFO)];
      const score = scorer.calculateScore(findings);
      expect(score.overall).toBe(99);
    });
  });

  describe('cumulative scoring', () => {
    it('should accumulate deductions from multiple findings', () => {
      const findings = [
        createFinding(SecuritySeverity.CRITICAL),
        createFinding(SecuritySeverity.HIGH),
      ];
      const score = scorer.calculateScore(findings);
      expect(score.overall).toBe(60); // 100 - 25 - 15
    });

    it('should handle multiple findings of same severity', () => {
      const findings = [
        createFinding(SecuritySeverity.HIGH),
        createFinding(SecuritySeverity.HIGH),
        createFinding(SecuritySeverity.HIGH),
      ];
      const score = scorer.calculateScore(findings);
      expect(score.overall).toBe(55); // 100 - 15 - 15 - 15
    });
  });

  describe('minimum score', () => {
    it('should not go below 0', () => {
      const findings = [
        createFinding(SecuritySeverity.CRITICAL),
        createFinding(SecuritySeverity.CRITICAL),
        createFinding(SecuritySeverity.CRITICAL),
        createFinding(SecuritySeverity.CRITICAL),
        createFinding(SecuritySeverity.CRITICAL),
      ];
      const score = scorer.calculateScore(findings);
      expect(score.overall).toBe(0); // 100 - 125 = clamped to 0
    });
  });

  describe('per-category scores', () => {
    it('should calculate separate scores per category', () => {
      const findings = [
        createFinding(SecuritySeverity.CRITICAL, SecurityScanType.VULNERABILITY),
        createFinding(SecuritySeverity.HIGH, SecurityScanType.SQL_INJECTION),
      ];
      const score = scorer.calculateScore(findings);
      expect(score.categories[SecurityScanType.VULNERABILITY]).toBe(75);
      expect(score.categories[SecurityScanType.SQL_INJECTION]).toBe(85);
      expect(score.categories[SecurityScanType.XSS]).toBe(100);
    });

    it('should clamp category scores to 0 minimum', () => {
      const findings = Array(5).fill(null).map(() =>
        createFinding(SecuritySeverity.CRITICAL, SecurityScanType.SECRET_DETECTION),
      );
      const score = scorer.calculateScore(findings);
      expect(score.categories[SecurityScanType.SECRET_DETECTION]).toBe(0);
    });
  });

  describe('getSeverityWeight', () => {
    it('should return correct weight for CRITICAL', () => {
      expect(scorer.getSeverityWeight(SecuritySeverity.CRITICAL)).toBe(-25);
    });

    it('should return correct weight for HIGH', () => {
      expect(scorer.getSeverityWeight(SecuritySeverity.HIGH)).toBe(-15);
    });

    it('should return correct weight for MEDIUM', () => {
      expect(scorer.getSeverityWeight(SecuritySeverity.MEDIUM)).toBe(-8);
    });

    it('should return correct weight for LOW', () => {
      expect(scorer.getSeverityWeight(SecuritySeverity.LOW)).toBe(-3);
    });

    it('should return correct weight for INFO', () => {
      expect(scorer.getSeverityWeight(SecuritySeverity.INFO)).toBe(-1);
    });
  });
});
