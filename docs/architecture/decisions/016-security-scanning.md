# ADR 016: Security Scanning Architecture

## Status

Accepted

## Context

The platform needs automated security scanning to detect vulnerabilities, exposed secrets, injection flaws, and other security issues in user projects. We need a system that supports:

- Multiple scan types: vulnerability detection, secret scanning, SQL injection, XSS, CSRF, authentication review, and full OWASP Top 10 coverage
- Severity-based categorization (CRITICAL, HIGH, MEDIUM, LOW, INFO)
- Security scoring (0-100) with weighted findings
- Configurable rules that can be enabled or disabled per project
- Pipeline-based scanning that aggregates results across multiple scanners
- Graceful handling of scanner failures without aborting the entire pipeline

The main options considered were:

1. **External scanning service integration**: Delegate scanning to third-party services (Snyk, SonarQube)
2. **Built-in scanner library with provider pattern**: Custom scanners following the adapter pattern
3. **Hybrid approach**: Core scanners built-in with extensibility for external scanner integration
4. **Rule-engine approach**: Generic rule engine with security-specific rule definitions

## Decision

We will implement a **built-in scanner library using the provider/adapter pattern with a pipeline orchestrator**:

### Scanner Architecture

- Abstract BaseSecurityScanner class that all scanners extend (following the BaseDeployProvider pattern)
- ScannerRegistry for managing available scanners by type
- Each scanner targets specific vulnerability categories with pattern-based detection

### Scan Types

- VulnerabilityScanner: Detects unsafe function usage, prototype pollution, known vulnerable patterns
- SecretScanner: Detects hardcoded API keys, tokens, passwords, private keys via regex patterns
- SqlInjectionScanner: Detects string concatenation in SQL, missing parameterization
- XssScanner: Detects innerHTML usage, unescaped output, missing Content-Security-Policy
- CsrfScanner: Detects missing CSRF tokens, state-changing GET requests
- AuthScanner: Detects weak hashing, missing rate limiting, insecure token storage

### Security Scoring

- Score range: 0 to 100 (starting at 100)
- Severity weights: CRITICAL=-25, HIGH=-15, MEDIUM=-8, LOW=-3, INFO=-1
- Per-category scores for detailed breakdown
- Minimum score clamped at 0

### Scan Pipeline

- ScanPipeline orchestrates multiple scanners in sequence
- Aggregates findings across all scanners
- Individual scanner failures are caught and logged without aborting the pipeline
- Final result includes all findings, overall score, and per-scanner status

### Configurable Rules

- SecurityRule model allows enabling/disabling individual rules
- Rules are categorized by scan type and severity
- Custom configuration per rule for threshold adjustment

## Consequences

### Positive

- **Immediate feedback**: Developers get security insights without external service dependencies
- **Extensibility**: New scanners follow the established adapter pattern for easy addition
- **Resilience**: Pipeline continues even if individual scanners fail
- **Actionable results**: Findings include file path, line number, snippet, and remediation advice
- **Customizable**: Rules can be tuned per project to reduce false positives

### Negative

- **Detection depth**: Pattern-based detection cannot match the sophistication of dedicated security tools
- **Maintenance burden**: Security patterns evolve and scanners require regular updates
- **False positives**: Regex-based detection may flag safe code patterns as issues
- **Resource usage**: Full OWASP scans on large codebases may be compute-intensive

### Mitigations

- Scanners are designed with conservative patterns to minimize false positives
- Each finding includes confidence level and recommendation for manual review
- Scan pipeline supports configurable file filtering to reduce scope
- Async scan execution prevents blocking user workflows
- Rule configuration allows disabling noisy rules on a per-project basis
