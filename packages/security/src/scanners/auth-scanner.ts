import {
  SecurityFinding,
  SecurityScanConfig,
  SecurityScanType,
  SecuritySeverity,
  ScanFile,
} from '../types/index.js';

import { BaseSecurityScanner, ScanPattern } from './base-scanner.js';

/**
 * AuthScanner reviews authentication patterns for common issues including
 * weak password hashing, missing rate limiting, and insecure token storage.
 */
export class AuthScanner extends BaseSecurityScanner {
  private findingCounter = 0;

  private readonly patterns: ScanPattern[] = [
    {
      name: 'weak-hash-md5',
      pattern: /(?:crypto\.createHash|md5|MD5)\s*\(\s*['"`]md5['"`]\s*\)/gi,
      description: 'Weak MD5 hashing used for passwords or sensitive data',
    },
    {
      name: 'weak-hash-sha1',
      pattern: /(?:crypto\.createHash|sha1|SHA1)\s*\(\s*['"`]sha1['"`]\s*\)/gi,
      description: 'Weak SHA1 hashing used for passwords or sensitive data',
    },
    {
      name: 'md5-direct',
      pattern: /\bmd5\s*\(/gi,
      description: 'Direct MD5 function call for hashing',
    },
    {
      name: 'missing-rate-limit',
      pattern: /(?:app|router)\.(post)\s*\(\s*['"`][^'"`]*(?:login|auth|signin|register|password)[^'"`]*['"`]/gi,
      description: 'Authentication endpoint potentially missing rate limiting',
    },
    {
      name: 'insecure-token-storage',
      pattern: /localStorage\.setItem\s*\(\s*['"`](?:token|jwt|auth|session|access_token)['"`]/gi,
      description: 'Sensitive token stored in localStorage (vulnerable to XSS)',
    },
    {
      name: 'hardcoded-jwt-secret',
      pattern: /(?:jwt|jsonwebtoken)\.sign\s*\([^,]+,\s*['"`][^'"`]{5,}['"`]/gi,
      description: 'JWT signed with hardcoded secret',
    },
    {
      name: 'no-password-validation',
      pattern: /password\s*[:=]\s*(?:req\.body|request\.body|body)\.[^;]*(?!.*(?:validate|check|length|min))/gi,
      description: 'Password accepted without validation checks',
    },
  ];

  getName(): string {
    return 'AuthScanner';
  }

  getSupportedPatterns(): ScanPattern[] {
    return [...this.patterns];
  }

  scan(files: ScanFile[], _config?: SecurityScanConfig): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    for (const file of files) {
      const lines = file.content.split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];

        for (const scanPattern of this.patterns) {
          const regex = new RegExp(scanPattern.pattern.source, scanPattern.pattern.flags);
          let match: RegExpExecArray | null;

          while ((match = regex.exec(line)) !== null) {
            findings.push(this.createFinding(
              scanPattern,
              file.path,
              lineIndex + 1,
              match.index + 1,
              line,
            ));
          }
        }
      }
    }

    return findings;
  }

  private createFinding(
    scanPattern: ScanPattern,
    filePath: string,
    lineNumber: number,
    column: number,
    snippet: string,
  ): SecurityFinding {
    this.findingCounter++;

    const severityMap: Record<string, SecuritySeverity> = {
      'weak-hash-md5': SecuritySeverity.CRITICAL,
      'weak-hash-sha1': SecuritySeverity.HIGH,
      'md5-direct': SecuritySeverity.CRITICAL,
      'missing-rate-limit': SecuritySeverity.MEDIUM,
      'insecure-token-storage': SecuritySeverity.HIGH,
      'hardcoded-jwt-secret': SecuritySeverity.CRITICAL,
      'no-password-validation': SecuritySeverity.MEDIUM,
    };

    const recommendationMap: Record<string, string> = {
      'weak-hash-md5': 'Use bcrypt, scrypt, or Argon2 for password hashing. MD5 is cryptographically broken.',
      'weak-hash-sha1': 'Use bcrypt, scrypt, or Argon2 for password hashing. SHA1 has known collision attacks.',
      'md5-direct': 'Use bcrypt, scrypt, or Argon2 for password hashing. MD5 is cryptographically broken.',
      'missing-rate-limit': 'Add rate limiting middleware (e.g., express-rate-limit) to authentication endpoints.',
      'insecure-token-storage': 'Store tokens in httpOnly cookies or use sessionStorage with proper XSS protections.',
      'hardcoded-jwt-secret': 'Load JWT secrets from environment variables or a secrets manager.',
      'no-password-validation': 'Validate password length and complexity before processing.',
    };

    return {
      id: `AUTH-${this.findingCounter}`,
      type: SecurityScanType.AUTH_REVIEW,
      severity: severityMap[scanPattern.name] || SecuritySeverity.MEDIUM,
      title: scanPattern.description,
      description: `Detected ${scanPattern.name} in ${filePath} at line ${lineNumber}. Authentication weaknesses can lead to account compromise.`,
      filePath,
      lineNumber,
      column,
      snippet: snippet.trim(),
      recommendation: recommendationMap[scanPattern.name] || 'Review and strengthen authentication implementation.',
      cweId: this.getCweId(scanPattern.name),
      owaspCategory: 'A07:2021 - Identification and Authentication Failures',
    };
  }

  private getCweId(patternName: string): string {
    const cweMap: Record<string, string> = {
      'weak-hash-md5': 'CWE-328',
      'weak-hash-sha1': 'CWE-328',
      'md5-direct': 'CWE-328',
      'missing-rate-limit': 'CWE-307',
      'insecure-token-storage': 'CWE-922',
      'hardcoded-jwt-secret': 'CWE-798',
      'no-password-validation': 'CWE-521',
    };
    return cweMap[patternName] || 'CWE-287';
  }
}
