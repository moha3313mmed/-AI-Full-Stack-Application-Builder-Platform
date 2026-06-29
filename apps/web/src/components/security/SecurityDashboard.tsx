'use client';

import { FindingsList } from '@/components/security/FindingsList';
import { ScanHistory } from '@/components/security/ScanHistory';
import { ScanTrigger } from '@/components/security/ScanTrigger';
import { SecurityRules, type SecurityRule } from '@/components/security/SecurityRules';
import { SecurityScore } from '@/components/security/SecurityScore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SecurityFinding, SecurityScan, SecurityScanType } from '@/hooks/useSecurityScans';

interface SecurityDashboardProps {
  score: number;
  scans: SecurityScan[];
  findings: SecurityFinding[];
  rules: SecurityRule[];
  onTriggerScan: (scanTypes: SecurityScanType[]) => void;
  onToggleRule?: (ruleId: string, enabled: boolean) => void;
  isScanning?: boolean;
}

export function SecurityDashboard({
  score,
  scans,
  findings,
  rules,
  onTriggerScan,
  onToggleRule,
  isScanning,
}: SecurityDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-6">
        <SecurityScore score={score} />
        <ScanTrigger onTrigger={onTriggerScan} isScanning={isScanning} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="findings">Findings</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <div className="space-y-4">
            <ScanHistory scans={scans.slice(0, 5)} />
          </div>
        </TabsContent>
        <TabsContent value="findings" className="mt-4">
          <FindingsList findings={findings} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <ScanHistory scans={scans} />
        </TabsContent>
        <TabsContent value="rules" className="mt-4">
          <SecurityRules rules={rules} onToggle={onToggleRule} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
