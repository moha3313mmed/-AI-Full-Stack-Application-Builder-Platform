'use client';

import { Bot, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { AgentStatus } from '@/hooks/useAgentStatus';

interface AgentIndicatorProps {
  agent: AgentStatus | null;
}

export function AgentIndicator({ agent }: AgentIndicatorProps) {
  if (!agent) return null;

  return (
    <div className="flex items-center gap-2 border-b px-4 py-2">
      <Bot className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium">{agent.role}</span>
      <Badge variant="secondary" className="gap-1">
        {(agent.status === 'thinking' || agent.status === 'working') && (
          <Loader2 className="h-3 w-3 animate-spin" />
        )}
        {agent.status}
      </Badge>
      {agent.currentTask && (
        <span className="text-xs text-muted-foreground truncate">
          {agent.currentTask}
        </span>
      )}
    </div>
  );
}
