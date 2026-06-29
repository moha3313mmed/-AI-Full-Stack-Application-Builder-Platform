import {
  SecurityFinding,
  SecurityScanConfig,
  SecurityScanType,
  SecuritySeverity,
  ScanFile,
} from '../types/index.js';

import { BaseSecurityScanner, ScanPattern } from './base-scanner.js';

/**
 * CsrfScanner detects Cross-Site Request Forgery (CSRF) vulnerabilities
 * including missing CSRF tokens, state-changing GET requests, and missing SameSite attributes.
 */
export class CsrfScanner extends BaseSecurityScanner {
  private findingCounter = 0;

  private readonly patterns: ScanPattern[] = [
    {
      name: 'form-missing-csrf',
      pattern: /<form\b[^>]*method\s*=\s*['"]post['"][^>]*>(?:(?!csrf|_token|xsrf)[\s\S])*?<\/form>/gi,
      description: 'Form with POST method missing CSRF token field',
    },
    {
      name: 'state-changing-get',
      pattern: /(?:app|router)\.get\s*\(\s*['"`][^'"`]*(?:delete|remove|update|create|modify)[^'"`]*['"`]/gi,
      description: 'State-changing operation exposed via GET route',
    },
    {
      name: 'missing-samesite',
      pattern: /(?:set-cookie|setCookie|cookie)\s*[:(=]\s*['"`][^'"`]*(?!SameSite)[^'"`]*['"`]/gi,
      description: 'Cookie set without SameSite attribute',
    },
    {
      name: 'cors-wildcard',
      pattern: /Access-Control-Allow-Origin['"`]?\s*[,):=]\s*['"`]\*['"`]/gi,
      description: 'CORS configured with wildcard origin',
    },
    {
      name: 'no-csrf-middleware',
      pattern: /(?:app|router)\.(post|put|patch|delete)\s*\([^)]*(?!csrf|csurf)/gi,
      description: 'State-changing route without CSRF middleware reference',
    },
  ];

  getName(): string {
    return 'CsrfScanner';
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

        // Check single-line patterns
        for (const scanPattern of this.patterns) {
          // Skip multi-line form pattern for line-by-line scanning
          if (scanPattern.name === 'form-missing-csrf') continue;

          const regex = new RegExp(scanPattern.pattern.source, scanPattern.pattern.flags);
          let match: RegExpExecArray | null;

          while ((match = regex.exec(line)) !== null) {
            findings.push(this.createFinding(scanPattern, file.path, lineIndex + 1, match.index + 1, line));
          }
        }
      }

      // Check multi-line form pattern against full content
      const formPattern = this.patterns[0];
      const formRegex = new RegExp(formPattern.pattern.source, formPattern.pattern.flags);
      let formMatch: RegExpExecArray | null;

      while ((formMatch = formRegex.exec(file.content)) !== null) {
        const lineNumber = file.content.substring(0, formMatch.index).split('\n').length;
        findings.push(this.createFinding(formPattern, file.path, lineNumber, 1, formMatch[0].substring(0, 80)));
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
      'form-missing-csrf': SecuritySeverity.HIGH,
      'state-changing-get': SecuritySeverity.HIGH,
      'missing-samesite': SecuritySeverity.MEDIUM,
      'cors-wildcard': SecuritySeverity.MEDIUM,
      'no-csrf-middleware': SecuritySeverity.LOW,
    };

    const recommendationMap: Record<string, string> = {
      'form-missing-csrf': 'Add a CSRF token hidden input field to all POST forms.',
      'state-changing-get': 'Use POST, PUT, or DELETE methods for state-changing operations, not GET.',
      'missing-samesite': 'Set SameSite=Strict or SameSite=Lax on all cookies.',
      'cors-wildcard': 'Restrict CORS origin to specific trusted domains instead of using wildcard.',
      'no-csrf-middleware': 'Apply CSRF protection middleware (e.g., csurf) to state-changing routes.',
    };

    return {
      id: `CSRF-${this.findingCounter}`,
      type: SecurityScanType.CSRF,
      severity: severityMap[scanPattern.name] || SecuritySeverity.MEDIUM,
      title: scanPattern.description,
      description: `Detected ${scanPattern.name} in ${filePath} at line ${lineNumber}. CSRF vulnerabilities allow attackers to perform unwanted actions on behalf of authenticated users.`,
      filePath,
      lineNumber,
      column,
      snippet: snippet.trim(),
      recommendation: recommendationMap[scanPattern.name] || 'Implement CSRF protection for state-changing operations.',
      cweId: 'CWE-352',
      owaspCategory: 'A01:2021 - Broken Access Control',
    };
  }
}
