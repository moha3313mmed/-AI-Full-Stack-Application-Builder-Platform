import { describe, it, expect, beforeEach } from 'vitest';

import { XssScanner } from '../scanners/xss-scanner.js';
import { SecurityScanType, SecuritySeverity, ScanFile } from '../types/index.js';

describe('XssScanner', () => {
  let scanner: XssScanner;

  beforeEach(() => {
    scanner = new XssScanner();
  });

  describe('getName', () => {
    it('should return the scanner name', () => {
      expect(scanner.getName()).toBe('XssScanner');
    });
  });

  describe('getSupportedPatterns', () => {
    it('should return supported patterns', () => {
      const patterns = scanner.getSupportedPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe('innerHTML detection', () => {
    it('should detect innerHTML assignment with variable', () => {
      const files: ScanFile[] = [{
        path: 'src/ui.ts',
        content: 'element.innerHTML = userContent;',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(1);
      expect(findings[0].type).toBe(SecurityScanType.XSS);
      expect(findings[0].severity).toBe(SecuritySeverity.HIGH);
      expect(findings[0].cweId).toBe('CWE-79');
    });

    it('should detect innerHTML with template literal', () => {
      const files: ScanFile[] = [{
        path: 'src/render.ts',
        content: 'div.innerHTML = `<p>${text}</p>`;',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('document.write detection', () => {
    it('should detect document.write usage', () => {
      const files: ScanFile[] = [{
        path: 'src/legacy.js',
        content: 'document.write("<h1>" + title + "</h1>");',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].severity).toBe(SecuritySeverity.HIGH);
    });

    it('should detect document.write with variable', () => {
      const files: ScanFile[] = [{
        path: 'src/old.js',
        content: 'document.write(htmlContent);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('outerHTML detection', () => {
    it('should detect outerHTML assignment', () => {
      const files: ScanFile[] = [{
        path: 'src/dom.ts',
        content: 'node.outerHTML = newHtml;',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(1);
      expect(findings[0].severity).toBe(SecuritySeverity.HIGH);
    });
  });

  describe('insertAdjacentHTML detection', () => {
    it('should detect insertAdjacentHTML usage', () => {
      const files: ScanFile[] = [{
        path: 'src/dom.ts',
        content: 'element.insertAdjacentHTML("beforeend", userHtml);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(1);
      expect(findings[0].severity).toBe(SecuritySeverity.MEDIUM);
    });
  });

  describe('dangerouslySetInnerHTML detection', () => {
    it('should detect dangerouslySetInnerHTML in React', () => {
      const files: ScanFile[] = [{
        path: 'src/Component.tsx',
        content: '<div dangerouslySetInnerHTML={{ __html: content }} />',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(1);
      expect(findings[0].severity).toBe(SecuritySeverity.MEDIUM);
    });
  });

  describe('safe code (no false positives)', () => {
    it('should not flag textContent assignment', () => {
      const files: ScanFile[] = [{
        path: 'src/safe.ts',
        content: 'element.textContent = userInput;',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(0);
    });

    it('should not flag createElement usage', () => {
      const files: ScanFile[] = [{
        path: 'src/dom.ts',
        content: 'const el = document.createElement("div");',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(0);
    });

    it('should not flag innerHTML cleared to empty string', () => {
      const files: ScanFile[] = [{
        path: 'src/dom.ts',
        content: 'element.innerHTML = "";',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(0);
    });
  });

  describe('finding properties', () => {
    it('should include OWASP category for XSS findings', () => {
      const files: ScanFile[] = [{
        path: 'src/ui.ts',
        content: 'document.write(userInput);',
      }];

      const findings = scanner.scan(files);
      expect(findings[0].owaspCategory).toBe('A03:2021 - Injection');
    });
  });
});
