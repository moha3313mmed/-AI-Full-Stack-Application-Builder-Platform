'use client';

import { SecurityDashboard } from '@/components/security/SecurityDashboard';
import type { SecurityRule } from '@/components/security/SecurityRules';
import { useSecurityScans } from '@/hooks/useSecurityScans';

const defaultRules: SecurityRule[] = [
  { id: 'rule-1', name: 'Detect eval() usage', type: 'VULNERABILITY', severity: 'HIGH', enabled: true },
  { id: 'rule-2', name: 'Check for hardcoded secrets', type: 'SECRET_DETECTION', severity: 'CRITICAL', enabled: true },
  { id: 'rule-3', name: 'SQL injection in queries', type: 'SQL_INJECTION', severity: 'HIGH', enabled: true },
  { id: 'rule-4', name: 'XSS via innerHTML', type: 'XSS', severity: 'MEDIUM', enabled: true },
  { id: 'rule-5', name: 'Missing CSRF tokens', type: 'CSRF', severity: 'MEDIUM', enabled: true },
  { id: 'rule-6', name: 'Weak password hashing', type: 'AUTH_REVIEW', severity: 'HIGH', enabled: true },
];

export default function SecurityPage() {
  const projectId = 'default-project';
  const { scans, score, triggerScan } = useSecurityScans(projectId);

  const allFindings = scans.flatMap((scan) => scan.findings ?? []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security</h1>
        <p className="text-muted-foreground">
          Monitor and improve your project security posture.
        </p>
      </div>

      <SecurityDashboard
        score={score.overall}
        scans={scans}
        findings={allFindings}
        rules={defaultRules}
        onTriggerScan={triggerScan}
      />
    </div>
  );
}
