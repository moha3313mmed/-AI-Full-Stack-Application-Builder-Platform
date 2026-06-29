import {
  SecurityFinding,
  SecurityScanConfig,
  SecurityScanType,
  SecuritySeverity,
  ScanFile,
} from '../types/index.js';

import { BaseSecurityScanner, ScanPattern } from './base-scanner.js';

/**
 * SecretScanner detects hardcoded secrets, API keys, tokens, passwords,
 * private keys, and connection strings in source code.
 */
export class SecretScanner extends BaseSecurityScanner {
  private findingCounter = 0;

  private readonly patterns: ScanPattern[] = [
    {
      name: 'aws-access-key',
      pattern: /AKIA[0-9A-Z]{16}/g,
      description: 'AWS Access Key ID detected',
    },
    {
      name: 'generic-api-key',
      pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"`]([a-zA-Z0-9_-]{20,})['"`]/gi,
      description: 'Generic API key detected',
    },
    {
      name: 'generic-secret',
      pattern: /(?:secret|token|password|passwd|pwd)\s*[:=]\s*['"`]([^\s'"` ]{8,})['"`]/gi,
      description: 'Hardcoded secret or password detected',
    },
    {
      name: 'private-key',
      pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g,
      description: 'Private key detected in source code',
    },
    {
      name: 'connection-string',
      pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"` ]+:[^\s'"` ]+@[^\s'"` ]+/gi,
      description: 'Database connection string with credentials detected',
    },
    {
      name: 'jwt-token',
      pattern: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
      description: 'Hardcoded JWT token detected',
    },
    {
      name: 'github-token',
      pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
      description: 'GitHub personal access token detected',
    },
  ];

  private customPatterns: ScanPattern[] = [];

  getName(): string {
    return 'SecretScanner';
  }

  getSupportedPatterns(): ScanPattern[] {
    return [...this.patterns, ...this.customPatterns];
  }

  /**
   * Register a custom pattern for secret detection.
   */
  registerPattern(pattern: ScanPattern): void {
    this.customPatterns.push(pattern);
  }

  scan(files: ScanFile[], _config?: SecurityScanConfig): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const allPatterns = [...this.patterns, ...this.customPatterns];

    for (const file of files) {
      const lines = file.content.split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];

        // Skip comment lines that are likely documentation
        if (this.isCommentLine(line)) {
          continue;
        }

        for (const scanPattern of allPatterns) {
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

  private isCommentLine(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('//') && trimmed.includes('example');
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
      'aws-access-key': SecuritySeverity.CRITICAL,
      'generic-api-key': SecuritySeverity.HIGH,
      'generic-secret': SecuritySeverity.HIGH,
      'private-key': SecuritySeverity.CRITICAL,
      'connection-string': SecuritySeverity.CRITICAL,
      'jwt-token': SecuritySeverity.HIGH,
      'github-token': SecuritySeverity.CRITICAL,
    };

    return {
      id: `SECRET-${this.findingCounter}`,
      type: SecurityScanType.SECRET_DETECTION,
      severity: severityMap[scanPattern.name] || SecuritySeverity.HIGH,
      title: scanPattern.description,
      description: `Detected ${scanPattern.name} in ${filePath} at line ${lineNumber}. Secrets should never be committed to source control.`,
      filePath,
      lineNumber,
      column,
      snippet: this.maskSecret(snippet),
      recommendation: 'Move secrets to environment variables or a secrets manager. Rotate the exposed credential immediately.',
      cweId: 'CWE-798',
    };
  }

  private maskSecret(snippet: string): string {
    // Mask the middle portion of detected secrets for safe reporting
    return snippet.replace(
      /(['"`])([a-zA-Z0-9_\-/.]{8,})\1/g,
      (_match, quote, value: string) => {
        if (value.length > 8) {
          return `${quote}${value.slice(0, 4)}****${value.slice(-4)}${quote}`;
        }
        return `${quote}****${quote}`;
      },
    );
  }
}
