'use client';

import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { SecurityScanType, SecuritySeverity } from '@/hooks/useSecurityScans';
import { cn } from '@/lib/utils';

export interface SecurityRule {
  id: string;
  name: string;
  type: SecurityScanType;
  severity: SecuritySeverity;
  enabled: boolean;
}

interface SecurityRulesProps {
  rules: SecurityRule[];
  onToggle?: (ruleId: string, enabled: boolean) => void;
}

function getSeverityColor(severity: SecuritySeverity): string {
  switch (severity) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'HIGH':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'LOW':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'INFO':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function SecurityRules({ rules, onToggle }: SecurityRulesProps) {
  const [localRules, setLocalRules] = useState(rules);

  const handleToggle = (ruleId: string) => {
    setLocalRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
    const rule = localRules.find((r) => r.id === ruleId);
    if (rule) {
      onToggle?.(ruleId, !rule.enabled);
    }
  };

  if (localRules.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">No security rules configured.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {localRules.map((rule) => (
        <Card key={rule.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{rule.name}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {rule.type}
                  </Badge>
                  <Badge className={cn('text-xs', getSeverityColor(rule.severity))}>
                    {rule.severity}
                  </Badge>
                </div>
              </div>
            </div>
            <button
              onClick={() => handleToggle(rule.id)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                rule.enabled ? 'bg-primary' : 'bg-muted'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                  rule.enabled ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
