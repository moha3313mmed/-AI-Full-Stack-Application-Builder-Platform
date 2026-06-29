import { describe, it, expect, beforeEach } from 'vitest';

import { CsrfScanner } from '../scanners/csrf-scanner.js';
import { SecurityScanType, SecuritySeverity, ScanFile } from '../types/index.js';

describe('CsrfScanner', () => {
  let scanner: CsrfScanner;

  beforeEach(() => {
    scanner = new CsrfScanner();
  });

  describe('getName', () => {
    it('should return the scanner name', () => {
      expect(scanner.getName()).toBe('CsrfScanner');
    });
  });

  describe('getSupportedPatterns', () => {
    it('should return supported patterns', () => {
      const patterns = scanner.getSupportedPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe('state-changing GET detection', () => {
    it('should detect delete operation on GET route', () => {
      const files: ScanFile[] = [{
        path: 'src/routes.ts',
        content: 'app.get("/api/delete-user", handler);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].type).toBe(SecurityScanType.CSRF);
      expect(findings[0].severity).toBe(SecuritySeverity.HIGH);
    });

    it('should detect update operation on GET route', () => {
      const files: ScanFile[] = [{
        path: 'src/routes.ts',
        content: 'router.get("/update-profile", handler);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect create operation on GET route', () => {
      const files: ScanFile[] = [{
        path: 'src/routes.ts',
        content: 'app.get("/create-order", handler);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('CORS wildcard detection', () => {
    it('should detect wildcard CORS origin', () => {
      const files: ScanFile[] = [{
        path: 'src/server.ts',
        content: 'res.setHeader("Access-Control-Allow-Origin", "*");',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].severity).toBe(SecuritySeverity.MEDIUM);
    });
  });

  describe('form CSRF token detection', () => {
    it('should detect POST form without CSRF token', () => {
      const files: ScanFile[] = [{
        path: 'src/form.html',
        content: '<form method="post" action="/submit"><input type="text" name="data"><button>Submit</button></form>',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('safe code (no false positives)', () => {
    it('should not flag GET route for reading data', () => {
      const files: ScanFile[] = [{
        path: 'src/routes.ts',
        content: 'app.get("/api/users", listUsers);',
      }];

      const findings = scanner.scan(files);
      // The no-csrf-middleware pattern may fire, but state-changing-get should not
      const stateChangingFindings = findings.filter(f => f.title.includes('State-changing'));
      expect(stateChangingFindings.length).toBe(0);
    });
  });

  describe('finding properties', () => {
    it('should include CWE-352 for CSRF findings', () => {
      const files: ScanFile[] = [{
        path: 'src/routes.ts',
        content: 'app.get("/api/remove-item", handler);',
      }];

      const findings = scanner.scan(files);
      expect(findings[0].cweId).toBe('CWE-352');
    });

    it('should include OWASP category', () => {
      const files: ScanFile[] = [{
        path: 'src/routes.ts',
        content: 'router.get("/delete-record", handler);',
      }];

      const findings = scanner.scan(files);
      expect(findings[0].owaspCategory).toBe('A01:2021 - Broken Access Control');
    });
  });
});
