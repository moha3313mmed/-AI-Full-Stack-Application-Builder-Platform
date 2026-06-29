'use client';

import useSWR from 'swr';

import { apiClient } from '@/lib/api';

export interface AgentExecution {
  id: string;
  projectId: string;
  agentRole: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  taskDescription: string;
  output?: string;
  tokensUsed?: number;
  duration?: number;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
}

const fetcher = (url: string) => apiClient.get<AgentExecution[]>(url);

export function useAgentActivity(projectId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    projectId ? `/projects/${projectId}/agents/executions` : null,
    fetcher
  );

  return {
    executions: data ?? [],
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  };
}
