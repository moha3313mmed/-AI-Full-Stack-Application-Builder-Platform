'use client';

import { Activity } from 'lucide-react';

import { AgentExecutionCard } from '@/components/agents/AgentExecutionCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAgentActivity } from '@/hooks/useAgentActivity';

interface AgentActivityPanelProps {
  projectId: string;
}

export function AgentActivityPanel({ projectId }: AgentActivityPanelProps) {
  const { executions, isLoading } = useAgentActivity(projectId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <span className="text-sm">Loading activity...</span>
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <Activity className="h-8 w-8" />
        <p className="text-sm">No agent executions yet</p>
        <p className="text-xs">Agent activity will appear here when agents run tasks</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-3">
        {executions.map((execution) => (
          <AgentExecutionCard key={execution.id} execution={execution} />
        ))}
      </div>
    </ScrollArea>
  );
}
