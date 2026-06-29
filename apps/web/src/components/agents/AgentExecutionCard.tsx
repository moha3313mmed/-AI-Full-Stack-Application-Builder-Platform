'use client';

import { Bot, ChevronDown, ChevronRight, Clock, Zap } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AgentExecution } from '@/hooks/useAgentActivity';

interface AgentExecutionCardProps {
  execution: AgentExecution;
}

function getStatusColor(status: AgentExecution['status']): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'IN_PROGRESS':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'FAILED':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return '';
  }
}

function formatDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

export function AgentExecutionCard({ execution }: AgentExecutionCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
      <div className="flex items-start gap-2">
        <Bot className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium truncate">
              {execution.agentRole}
            </span>
            <Badge className={`text-[10px] ${getStatusColor(execution.status)}`}>
              {execution.status.replace('_', ' ').toLowerCase()}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate mb-1">
            {execution.taskDescription}
          </p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            {execution.duration != null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(execution.duration)}
              </span>
            )}
            {execution.tokensUsed != null && (
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {execution.tokensUsed.toLocaleString()} tokens
              </span>
            )}
          </div>
        </div>
        {execution.output && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 shrink-0"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>
      {expanded && execution.output && (
        <div className="mt-2 rounded border bg-muted/50 p-2">
          <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-words">
            {execution.output}
          </pre>
        </div>
      )}
    </div>
  );
}
