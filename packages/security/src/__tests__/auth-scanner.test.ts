import { describe, it, expect, beforeEach } from 'vitest';

import { AuthScanner } from '../scanners/auth-scanner.js';
import { SecurityScanType, SecuritySeverity, ScanFile } from '../types/index.js';

describe('AuthScanner', () => {
  let scanner: AuthScanner;

  beforeEach(() => {
    scanner = new AuthScanner();
  });

  describe('getName', () => {
    it('should return the scanner name', () => {
      expect(scanner.getName()).toBe('AuthScanner');
    });
  });

  describe('getSupportedPatterns', () => {
    it('should return supported patterns', () => {
      const patterns = scanner.getSupportedPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe('weak hash MD5 detection', () => {
    it('should detect MD5 hashing', () => {
      const files: ScanFile[] = [{
        path: 'src/auth.ts',
        content: 'const hash = crypto.createHash("md5").update(password).digest("hex");',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].type).toBe(SecurityScanType.AUTH_REVIEW);
      expect(findings[0].severity).toBe(SecuritySeverity.CRITICAL);
    });

    it('should detect direct md5 function call', () => {
      const files: ScanFile[] = [{
        path: 'src/hash.ts',
        content: 'const hashed = md5(password);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('weak hash SHA1 detection', () => {
    it('should detect SHA1 hashing', () => {
      const files: ScanFile[] = [{
        path: 'src/auth.ts',
        content: 'const hash = crypto.createHash("sha1").update(data).digest("hex");',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].severity).toBe(SecuritySeverity.HIGH);
      expect(findings[0].cweId).toBe('CWE-328');
    });
  });

  describe('missing rate limiting detection', () => {
    it('should flag login endpoint without rate limiting', () => {
      const files: ScanFile[] = [{
        path: 'src/routes.ts',
        content: 'app.post("/api/login", loginHandler);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].severity).toBe(SecuritySeverity.MEDIUM);
    });

    it('should flag register endpoint without rate limiting', () => {
      const files: ScanFile[] = [{
        path: 'src/routes.ts',
        content: 'router.post("/auth/register", registerHandler);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('insecure token storage detection', () => {
    it('should detect localStorage token storage', () => {
      const files: ScanFile[] = [{
        path: 'src/auth.ts',
        content: 'localStorage.setItem("token", response.data.token);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(1);
      expect(findings[0].severity).toBe(SecuritySeverity.HIGH);
      expect(findings[0].cweId).toBe('CWE-922');
    });

    it('should detect JWT stored in localStorage', () => {
      const files: ScanFile[] = [{
        path: 'src/login.ts',
        content: 'localStorage.setItem("jwt", token);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(1);
    });
  });

  describe('hardcoded JWT secret detection', () => {
    it('should detect hardcoded JWT signing secret', () => {
      const files: ScanFile[] = [{
        path: 'src/auth.ts',
        content: 'const token = jwt.sign(payload, "mySecretKey123");',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBeGreaterThanOrEqual(1);
      expect(findings[0].severity).toBe(SecuritySeverity.CRITICAL);
    });
  });

  describe('safe code (no false positives)', () => {
    it('should not flag bcrypt usage', () => {
      const files: ScanFile[] = [{
        path: 'src/auth.ts',
        content: 'const hash = await bcrypt.hash(password, 12);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(0);
    });

    it('should not flag environment variable JWT secret', () => {
      const files: ScanFile[] = [{
        path: 'src/auth.ts',
        content: 'const token = jwt.sign(payload, process.env.JWT_SECRET);',
      }];

      const findings = scanner.scan(files);
      expect(findings.length).toBe(0);
    });
  });

  describe('finding properties', () => {
    it('should include OWASP category for auth findings', () => {
      const files: ScanFile[] = [{
        path: 'src/auth.ts',
        content: 'localStorage.setItem("access_token", token);',
      }];

      const findings = scanner.scan(files);
      expect(findings[0].owaspCategory).toBe('A07:2021 - Identification and Authentication Failures');
    });
  });
});
