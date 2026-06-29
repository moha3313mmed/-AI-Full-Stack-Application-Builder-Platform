'use client';

import { useState } from 'react';

import { FindingCard } from '@/components/security/FindingCard';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SecurityFinding, SecuritySeverity } from '@/hooks/useSecurityScans';

interface FindingsListProps {
  findings: SecurityFinding[];
}

const severityFilters: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

export function FindingsList({ findings }: FindingsListProps) {
  const [filter, setFilter] = useState<string>('all');

  const filteredFindings = findings.filter((finding) => {
    if (filter === 'all') return true;
    return finding.severity === (filter as SecuritySeverity);
  });

  return (
    <Tabs value={filter} onValueChange={setFilter}>
      <TabsList>
        {severityFilters.map((f) => (
          <TabsTrigger key={f.value} value={f.value}>
            {f.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={filter} className="mt-4">
        {filteredFindings.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">No findings found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredFindings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
