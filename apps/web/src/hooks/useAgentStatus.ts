'use client';

import { useEffect, useState } from 'react';

import { wsClient } from '@/lib/websocket';

export interface AgentStatus {
  role: string;
  status: 'idle' | 'thinking' | 'working' | 'complete';
  currentTask?: string;
}

export function useAgentStatus(projectId: string) {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentStatus | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const unsubStatus = wsClient.subscribe('agent_status', (data) => {
      const status = data as AgentStatus;
      setAgents((prev) => {
        const idx = prev.findIndex((a) => a.role === status.role);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = status;
          return updated;
        }
        return [...prev, status];
      });

      if (status.status === 'thinking' || status.status === 'working') {
        setActiveAgent(status);
      } else if (activeAgent?.role === status.role) {
        setActiveAgent(null);
      }
    });

    return () => {
      unsubStatus();
    };
  }, [projectId, activeAgent?.role]);

  return {
    agents,
    activeAgent,
  };
}
