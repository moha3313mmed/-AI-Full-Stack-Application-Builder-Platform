import {
  SecurityFinding,
  SecurityScanConfig,
  SecurityScanType,
  SecuritySeverity,
  ScanFile,
} from '../types/index.js';

import { BaseSecurityScanner, ScanPattern } from './base-scanner.js';

/**
 * SqlInjectionScanner detects SQL injection vulnerabilities including
 * string concatenation in queries, template literals, and missing parameterization.
 */
export class SqlInjectionScanner extends BaseSecurityScanner {
  private findingCounter = 0;

  private readonly patterns: ScanPattern[] = [
    {
      name: 'string-concat-sql',
      pattern: /(?:query|execute|exec)\s*\(\s*['"`](?:SELECT|INSERT|UPDATE|DELETE|DROP)\b[^'"`]*['"`]\s*\+/gi,
      description: 'SQL query built with string concatenation',
    },
    {
      name: 'template-literal-sql',
      pattern: /(?:query|execute|exec)\s*\(\s*`(?:SELECT|INSERT|UPDATE|DELETE|DROP)\b[^`]*\$\{/gi,
      description: 'SQL query built with template literal interpolation',
    },
    {
      name: 'direct-variable-sql',
      pattern: /(?:WHERE|AND|OR)\s+\w+\s*=\s*['"`]?\s*['"`]?\s*\+\s*\w+/gi,
      description: 'SQL WHERE clause with direct variable concatenation',
    },
    {
      name: 'raw-query-concat',
      pattern: /(?:raw|rawQuery|knex\.raw)\s*\(\s*['"`][^'"`]*['"`]\s*\+/gi,
      description: 'Raw SQL query using string concatenation',
    },
    {
      name: 'unsafe-interpolation',
      pattern: /(?:raw|rawQuery|knex\.raw)\s*\(\s*`[^`]*\$\{/gi,
      description: 'Raw SQL query using unsafe template interpolation',
    },
  ];

  getName(): string {
    return 'SqlInjectionScanner';
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

    return {
      id: `SQLI-${this.findingCounter}`,
      type: SecurityScanType.SQL_INJECTION,
      severity: SecuritySeverity.CRITICAL,
      title: scanPattern.description,
      description: `Detected ${scanPattern.name} in ${filePath} at line ${lineNumber}. User input in SQL queries can allow attackers to execute arbitrary SQL commands.`,
      filePath,
      lineNumber,
      column,
      snippet: snippet.trim(),
      recommendation: 'Use parameterized queries or prepared statements. Never concatenate user input into SQL strings.',
      cweId: 'CWE-89',
      owaspCategory: 'A03:2021 - Injection',
    };
  }
}
