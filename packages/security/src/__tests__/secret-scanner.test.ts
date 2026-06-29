import { describe, it, expect, beforeEach } from 'vitest';

import { SecretScanner } from '../scanners/secret-scanner.js';
import { SecurityScanType, SecuritySeverity, ScanFile } from '../types/index.js';

describe('SecretScanner', () => {
  let scanner: SecretScanner;

  beforeEach(() => {
    scanner = new SecretScanner();
  });

  describe('getName', () => {
    it('should return the scanner name', () => {
      expect(scanner.getName()).toBe('SecretScanner');
    });
  });

  describe('getSupportedPatterns', () => {
    it('should return built-in patterns', () => {
      const patterns = scanner.getSupportedPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should include custom patterns after registration', () => {
      const initialCount = scanner.getSupportedPatterns().length;
      scanner.registerPattern({
        name: 'custom-key',
        pattern: /CUSTOM_[A-Z0-9]{20}/g,
        description: 'Custom key pattern',
      });
      expect(scanner.getSupportedPatterns().length).toBe(initialCount + 1);
    });
  });

  describe('AWS credential detection', () => {
    it('should detect AWS access key IDs', () => {
      const files: ScanFile[] = [{
        path: 'config.ts',
        content: 'const key = "AKIAIOSFODNN7EXAMPLE";',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(1);
      expect(findings[0].type).toBe(SecurityScanType.SECRET_DETECTION);
      expect(findings[0].severity).toBe(SecuritySeverity.CRITICAL);
    });
  });

  describe('API key detection', () => {
    it('should detect generic API keys', () => {
      const files: ScanFile[] = [{
        path: 'src/config.js',
        content: 'const api_key = "sk_live_abcdefghij1234567890";',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings.some(f => f.title.toLowerCase().includes('api key') || f.title.toLowerCase().includes('secret'))).toBe(true);
    });
  });

  describe('password and secret detection', () => {
    it('should detect hardcoded passwords', () => {
      const files: ScanFile[] = [{
        path: 'src/db.ts',
        content: 'const password = "SuperSecretP@ss123";',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].cweId).toBe('CWE-798');
    });

    it('should detect hardcoded tokens', () => {
      const files: ScanFile[] = [{
        path: 'src/auth.ts',
        content: 'const token = "mySecretTokenValue12345678";',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('private key detection', () => {
    it('should detect RSA private keys', () => {
      const files: ScanFile[] = [{
        path: 'certs/key.pem',
        content: '-----BEGIN RSA PRIVATE KEY-----\nMIIBogIBAAJBAK...',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(1);
      expect(findings[0].severity).toBe(SecuritySeverity.CRITICAL);
    });

    it('should detect EC private keys', () => {
      const files: ScanFile[] = [{
        path: 'certs/ec.pem',
        content: '-----BEGIN EC PRIVATE KEY-----\nMHQCAQEE...',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(1);
    });
  });

  describe('connection string detection', () => {
    it('should detect MongoDB connection strings', () => {
      const files: ScanFile[] = [{
        path: 'src/db.ts',
        content: 'const uri = "mongodb://admin:password123@localhost:27017/db";',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings.some(f => f.title.toLowerCase().includes('connection string'))).toBe(true);
    });

    it('should detect PostgreSQL connection strings', () => {
      const files: ScanFile[] = [{
        path: 'src/db.ts',
        content: 'const url = "postgres://user:pass@host:5432/mydb";',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('JWT token detection', () => {
    it('should detect hardcoded JWT tokens', () => {
      const files: ScanFile[] = [{
        path: 'src/test.ts',
        content: 'const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiYWRtaW4ifQ.dGVzdHNpZ25hdHVyZQ";',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GitHub token detection', () => {
    it('should detect GitHub personal access tokens', () => {
      const files: ScanFile[] = [{
        path: 'src/config.ts',
        content: 'const token = "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789";',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('safe code (no false positives)', () => {
    it('should not flag environment variable references', () => {
      const files: ScanFile[] = [{
        path: 'src/config.ts',
        content: 'const apiKey = process.env.API_KEY;',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(0);
    });

    it('should not flag placeholder values', () => {
      const files: ScanFile[] = [{
        path: 'src/config.ts',
        content: 'const key = "YOUR_API_KEY_HERE";',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(0);
    });
  });

  describe('custom pattern registration', () => {
    it('should detect custom patterns after registration', () => {
      scanner.registerPattern({
        name: 'custom-token',
        pattern: /CUSTOM_[A-Z0-9]{16}/g,
        description: 'Custom token detected',
      });

      const files: ScanFile[] = [{
        path: 'src/app.ts',
        content: 'const t = "CUSTOM_ABCDEF1234567890";',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });
  });
});
