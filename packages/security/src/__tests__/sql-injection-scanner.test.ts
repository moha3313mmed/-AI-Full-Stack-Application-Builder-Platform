import { describe, it, expect, beforeEach } from 'vitest';

import { SqlInjectionScanner } from '../scanners/sql-injection-scanner.js';
import { SecurityScanType, SecuritySeverity, ScanFile } from '../types/index.js';

describe('SqlInjectionScanner', () => {
  let scanner: SqlInjectionScanner;

  beforeEach(() => {
    scanner = new SqlInjectionScanner();
  });

  describe('getName', () => {
    it('should return the scanner name', () => {
      expect(scanner.getName()).toBe('SqlInjectionScanner');
    });
  });

  describe('getSupportedPatterns', () => {
    it('should return supported patterns', () => {
      const patterns = scanner.getSupportedPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe('string concatenation detection', () => {
    it('should detect string concatenation in SQL query', () => {
      const files: ScanFile[] = [{
        path: 'src/db.ts',
        content: 'db.query("SELECT * FROM users WHERE id = " + userId);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].type).toBe(SecurityScanType.SQL_INJECTION);
      expect(findings[0].severity).toBe(SecuritySeverity.CRITICAL);
      expect(findings[0].cweId).toBe('CWE-89');
    });

    it('should detect concatenation in execute calls', () => {
      const files: ScanFile[] = [{
        path: 'src/repo.ts',
        content: 'conn.execute("DELETE FROM orders WHERE id = " + orderId);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('template literal detection', () => {
    it('should detect template literals in SQL queries', () => {
      const files: ScanFile[] = [{
        path: 'src/db.ts',
        content: 'db.query(`SELECT * FROM users WHERE name = ${userName}`);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].severity).toBe(SecuritySeverity.CRITICAL);
    });

    it('should detect template literals in execute calls', () => {
      const files: ScanFile[] = [{
        path: 'src/repo.ts',
        content: 'conn.execute(`INSERT INTO logs VALUES (${data})`);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('WHERE clause concatenation', () => {
    it('should detect WHERE clause with variable concatenation', () => {
      const files: ScanFile[] = [{
        path: 'src/search.ts',
        content: 'const sql = "WHERE name = \'" + userInput',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('raw query detection', () => {
    it('should detect raw query with concatenation', () => {
      const files: ScanFile[] = [{
        path: 'src/orm.ts',
        content: 'knex.raw("SELECT * FROM table WHERE col = " + val);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect raw query with template interpolation', () => {
      const files: ScanFile[] = [{
        path: 'src/orm.ts',
        content: 'knex.raw(`SELECT * FROM users WHERE id = ${id}`);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('safe code (no false positives)', () => {
    it('should not flag parameterized queries', () => {
      const files: ScanFile[] = [{
        path: 'src/db.ts',
        content: 'db.query("SELECT * FROM users WHERE id = $1", [userId]);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(0);
    });

    it('should not flag ORM method calls', () => {
      const files: ScanFile[] = [{
        path: 'src/repo.ts',
        content: 'const user = await User.findOne({ where: { id: userId } });',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(0);
    });

    it('should not flag string literals without concatenation', () => {
      const files: ScanFile[] = [{
        path: 'src/db.ts',
        content: 'const sql = "SELECT * FROM users";',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(0);
    });
  });

  describe('finding properties', () => {
    it('should include OWASP category', () => {
      const files: ScanFile[] = [{
        path: 'src/db.ts',
        content: 'db.query("SELECT id FROM users WHERE name = " + name);',
      }];

      const findings = scanner.scan(files);
      expect(findings[0].owaspCategory).toBe('A03:2021 - Injection');
    });
  });
});
