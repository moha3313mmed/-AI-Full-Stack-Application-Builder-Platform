'use client';

import { AlertTriangle, ChevronRight, Info, XCircle } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { SecurityFinding, SecuritySeverity } from '@/hooks/useSecurityScans';
import { cn } from '@/lib/utils';

interface FindingCardProps {
  finding: SecurityFinding;
}

function getSeverityConfig(severity: SecuritySeverity): {
  color: string;
  icon: React.ElementType;
} {
  switch (severity) {
    case 'CRITICAL':
      return { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle };
    case 'HIGH':
      return { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertTriangle };
    case 'MEDIUM':
      return { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertTriangle };
    case 'LOW':
      return { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Info };
    case 'INFO':
      return { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Info };
    default:
      return { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Info };
  }
}

export function FindingCard({ finding }: FindingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { color, icon: SeverityIcon } = getSeverityConfig(finding.severity);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <SeverityIcon className={cn('h-4 w-4 mt-0.5 shrink-0', {
            'text-red-500': finding.severity === 'CRITICAL',
            'text-orange-500': finding.severity === 'HIGH',
            'text-yellow-500': finding.severity === 'MEDIUM',
            'text-blue-500': finding.severity === 'LOW',
            'text-gray-500': finding.severity === 'INFO',
          })} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={cn('text-xs', color)}>
                {finding.severity}
              </Badge>
              <h4 className="text-sm font-medium truncate">{finding.title}</h4>
            </div>
            <p className="text-xs font-mono text-muted-foreground mb-1">
              {finding.filePath}:{finding.lineNumber}
            </p>
            <p className="text-sm text-muted-foreground">{finding.description}</p>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
            >
              <ChevronRight className={cn('h-3 w-3 transition-transform', {
                'rotate-90': expanded,
              })} />
              Recommendation
            </button>
            {expanded && (
              <div className="mt-2 p-2 rounded-md bg-muted text-sm">
                {finding.recommendation}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
