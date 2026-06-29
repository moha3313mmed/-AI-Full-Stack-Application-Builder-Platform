import {
  SecurityFinding,
  SecurityScanConfig,
  SecurityScanType,
  SecuritySeverity,
  ScanFile,
} from '../types/index.js';

import { BaseSecurityScanner, ScanPattern } from './base-scanner.js';

/**
 * XssScanner detects Cross-Site Scripting (XSS) vulnerabilities including
 * innerHTML usage, document.write, unescaped template output, and unsafe DOM manipulation.
 */
export class XssScanner extends BaseSecurityScanner {
  private findingCounter = 0;

  private readonly patterns: ScanPattern[] = [
    {
      name: 'innerHTML-assignment',
      pattern: /\.innerHTML\s*=\s*[a-zA-Z_$`]/g,
      description: 'Direct innerHTML assignment with dynamic content',
    },
    {
      name: 'document-write',
      pattern: /document\.write\s*\(/g,
      description: 'Use of document.write() can inject arbitrary HTML',
    },
    {
      name: 'outerHTML-assignment',
      pattern: /\.outerHTML\s*=/g,
      description: 'Direct outerHTML assignment with dynamic content',
    },
    {
      name: 'insertAdjacentHTML',
      pattern: /\.insertAdjacentHTML\s*\(/g,
      description: 'insertAdjacentHTML can inject unsanitized HTML',
    },
    {
      name: 'dangerouslySetInnerHTML',
      pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/g,
      description: 'React dangerouslySetInnerHTML with dynamic content',
    },
    {
      name: 'unsafe-template-dom',
      pattern: /\$\{[^}]+\}.*<\/?\w+/g,
      description: 'Template literal with HTML tags and dynamic values',
    },
  ];

  getName(): string {
    return 'XssScanner';
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
            findings.push(this.createFinding(scanPattern, file.path, lineIndex + 1, match.index + 1, line));
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
      'innerHTML-assignment': SecuritySeverity.HIGH,
      'document-write': SecuritySeverity.HIGH,
      'outerHTML-assignment': SecuritySeverity.HIGH,
      'insertAdjacentHTML': SecuritySeverity.MEDIUM,
      'dangerouslySetInnerHTML': SecuritySeverity.MEDIUM,
      'unsafe-template-dom': SecuritySeverity.MEDIUM,
    };

    const recommendationMap: Record<string, string> = {
      'innerHTML-assignment': 'Use textContent for text or a sanitization library like DOMPurify before inserting HTML.',
      'document-write': 'Use DOM manipulation methods (createElement, appendChild) instead of document.write.',
      'outerHTML-assignment': 'Use DOM manipulation methods and sanitize any dynamic content.',
      'insertAdjacentHTML': 'Sanitize content with DOMPurify before passing to insertAdjacentHTML.',
      'dangerouslySetInnerHTML': 'Sanitize HTML content with DOMPurify before using dangerouslySetInnerHTML.',
      'unsafe-template-dom': 'Escape dynamic values before embedding them in HTML templates.',
    };

    return {
      id: `XSS-${this.findingCounter}`,
      type: SecurityScanType.XSS,
      severity: severityMap[scanPattern.name] || SecuritySeverity.HIGH,
      title: scanPattern.description,
      description: `Detected ${scanPattern.name} in ${filePath} at line ${lineNumber}. Unescaped user input in HTML can allow script injection.`,
      filePath,
      lineNumber,
      column,
      snippet: snippet.trim(),
      recommendation: recommendationMap[scanPattern.name] || 'Sanitize all user input before rendering in HTML.',
      cweId: 'CWE-79',
      owaspCategory: 'A03:2021 - Injection',
    };
  }
}
