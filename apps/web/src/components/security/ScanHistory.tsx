'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { ScanStatus, SecurityScan } from '@/hooks/useSecurityScans';
import { cn } from '@/lib/utils';

interface ScanHistoryProps {
  scans: SecurityScan[];
}

function getStatusColor(status: ScanStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'RUNNING':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'FAILED':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'PENDING':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function ScanHistory({ scans }: ScanHistoryProps) {
  if (scans.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">No scans have been run yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground">
        <span>Type</span>
        <span>Date</span>
        <span>Findings</span>
        <span>Score</span>
        <span>Status</span>
      </div>
      {scans.map((scan) => (
        <Card key={scan.id}>
          <CardContent className="grid grid-cols-5 gap-4 items-center p-4">
            <Badge variant="outline" className="text-xs w-fit">
              {scan.scanType}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {new Date(scan.startedAt).toLocaleDateString()}
            </span>
            <span className="text-sm">{scan.findingsCount}</span>
            <span className={cn('text-sm font-medium', {
              'text-green-500': scan.score >= 80,
              'text-yellow-500': scan.score >= 60 && scan.score < 80,
              'text-orange-500': scan.score >= 40 && scan.score < 60,
              'text-red-500': scan.score < 40,
            })}>
              {scan.score}
            </span>
            <Badge className={cn('text-xs w-fit', getStatusColor(scan.status))}>
              {scan.status}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
