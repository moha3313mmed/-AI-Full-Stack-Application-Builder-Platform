import { SecurityScanType, SecuritySeverity } from '../types/index.js';

/**
 * OWASP Top 10 rule definition.
 */
export interface OwaspRule {
  id: string;
  category: string;
  title: string;
  description: string;
  cweIds: string[];
  severity: SecuritySeverity;
  scanTypes: SecurityScanType[];
  detectionPatterns: RegExp[];
}

/**
 * OWASP Top 10 (2021) rules with CWE mappings and detection patterns.
 */
export const OWASP_TOP_10_RULES: OwaspRule[] = [
  {
    id: 'A01:2021',
    category: 'Broken Access Control',
    title: 'Broken Access Control',
    description: 'Restrictions on what authenticated users are allowed to do are often not properly enforced.',
    cweIds: ['CWE-200', 'CWE-201', 'CWE-352', 'CWE-639'],
    severity: SecuritySeverity.CRITICAL,
    scanTypes: [SecurityScanType.CSRF, SecurityScanType.AUTH_REVIEW],
    detectionPatterns: [
      /(?:app|router)\.get\s*\(\s*['"`][^'"`]*(?:admin|user|account)[^'"`]*['"`]\s*,\s*(?!.*(?:auth|guard|protect))/gi,
      /(?:isAdmin|isOwner|hasPermission)\s*=\s*(?:req\.query|req\.params)/gi,
    ],
  },
  {
    id: 'A02:2021',
    category: 'Cryptographic Failures',
    title: 'Cryptographic Failures',
    description: 'Failures related to cryptography which often lead to sensitive data exposure.',
    cweIds: ['CWE-259', 'CWE-327', 'CWE-328', 'CWE-331'],
    severity: SecuritySeverity.HIGH,
    scanTypes: [SecurityScanType.AUTH_REVIEW, SecurityScanType.SECRET_DETECTION],
    detectionPatterns: [
      /(?:createHash|hash)\s*\(\s*['"`](?:md5|sha1)['"`]/gi,
      /(?:DES|RC4|Blowfish)/gi,
    ],
  },
  {
    id: 'A03:2021',
    category: 'Injection',
    title: 'Injection',
    description: 'User-supplied data is not validated, filtered, or sanitized by the application.',
    cweIds: ['CWE-79', 'CWE-89', 'CWE-73', 'CWE-77'],
    severity: SecuritySeverity.CRITICAL,
    scanTypes: [SecurityScanType.SQL_INJECTION, SecurityScanType.XSS],
    detectionPatterns: [
      /\beval\s*\(/g,
      /\.innerHTML\s*=/g,
      /(?:query|execute)\s*\(\s*['"`].*\+/g,
    ],
  },
  {
    id: 'A04:2021',
    category: 'Insecure Design',
    title: 'Insecure Design',
    description: 'Missing or ineffective control design. Risks that can be addressed with secure design patterns.',
    cweIds: ['CWE-209', 'CWE-256', 'CWE-501', 'CWE-522'],
    severity: SecuritySeverity.MEDIUM,
    scanTypes: [SecurityScanType.VULNERABILITY],
    detectionPatterns: [
      /(?:password|secret)\s*[:=]\s*['"`][^'"`]+['"`]/gi,
      /(?:catch|error)\s*\([^)]*\)\s*\{[^}]*(?:stack|message)/gi,
    ],
  },
  {
    id: 'A05:2021',
    category: 'Security Misconfiguration',
    title: 'Security Misconfiguration',
    description: 'Application is missing security hardening or has improperly configured permissions.',
    cweIds: ['CWE-16', 'CWE-611', 'CWE-1004'],
    severity: SecuritySeverity.MEDIUM,
    scanTypes: [SecurityScanType.VULNERABILITY, SecurityScanType.CSRF],
    detectionPatterns: [
      /(?:debug|verbose)\s*[:=]\s*true/gi,
      /(?:Access-Control-Allow-Origin)\s*[:=]\s*['"`]\*['"`]/gi,
    ],
  },
  {
    id: 'A06:2021',
    category: 'Vulnerable and Outdated Components',
    title: 'Vulnerable and Outdated Components',
    description: 'Using components with known vulnerabilities.',
    cweIds: ['CWE-1035', 'CWE-1104'],
    severity: SecuritySeverity.MEDIUM,
    scanTypes: [SecurityScanType.VULNERABILITY],
    detectionPatterns: [
      /require\s*\(\s*['"`](?:express|lodash|moment)['"`]\)/g,
    ],
  },
  {
    id: 'A07:2021',
    category: 'Identification and Authentication Failures',
    title: 'Identification and Authentication Failures',
    description: 'Confirmation of the user identity, authentication, and session management vulnerabilities.',
    cweIds: ['CWE-287', 'CWE-307', 'CWE-384', 'CWE-613'],
    severity: SecuritySeverity.HIGH,
    scanTypes: [SecurityScanType.AUTH_REVIEW],
    detectionPatterns: [
      /(?:session|cookie).*(?:httpOnly|secure)\s*[:=]\s*false/gi,
      /(?:bcrypt|argon2).*rounds\s*[:=]\s*[1-4]\b/gi,
    ],
  },
  {
    id: 'A08:2021',
    category: 'Software and Data Integrity Failures',
    title: 'Software and Data Integrity Failures',
    description: 'Code and infrastructure that does not protect against integrity violations.',
    cweIds: ['CWE-345', 'CWE-502', 'CWE-829'],
    severity: SecuritySeverity.HIGH,
    scanTypes: [SecurityScanType.VULNERABILITY],
    detectionPatterns: [
      /(?:JSON\.parse|deserialize|unserialize)\s*\(\s*(?:req\.body|request\.body|input)/gi,
      /(?:integrity|crossorigin)\s*=\s*['"`]['"`]/gi,
    ],
  },
  {
    id: 'A09:2021',
    category: 'Security Logging and Monitoring Failures',
    title: 'Security Logging and Monitoring Failures',
    description: 'Without logging and monitoring, breaches cannot be detected.',
    cweIds: ['CWE-117', 'CWE-223', 'CWE-532', 'CWE-778'],
    severity: SecuritySeverity.LOW,
    scanTypes: [SecurityScanType.AUTH_REVIEW],
    detectionPatterns: [
      /console\.(log|error|warn)\s*\(\s*['"`].*(?:password|token|secret)/gi,
    ],
  },
  {
    id: 'A10:2021',
    category: 'Server-Side Request Forgery (SSRF)',
    title: 'Server-Side Request Forgery',
    description: 'SSRF flaws occur when a web application fetches a remote resource without validating the user-supplied URL.',
    cweIds: ['CWE-918'],
    severity: SecuritySeverity.HIGH,
    scanTypes: [SecurityScanType.VULNERABILITY],
    detectionPatterns: [
      /(?:fetch|axios|http\.get|request)\s*\(\s*(?:req\.body|req\.query|req\.params|request\.body)\./gi,
      /(?:url|href|src)\s*[:=]\s*(?:req\.body|req\.query|req\.params)/gi,
    ],
  },
];
