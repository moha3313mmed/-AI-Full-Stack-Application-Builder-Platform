'use client';

import useSWR from 'swr';

import { apiClient } from '@/lib/api';

export interface ActivityEvent {
  id: string;
  projectId: string;
  type: 'commit' | 'deploy' | 'comment' | 'member_joined' | 'member_left' | 'branch_created' | 'pr_opened' | 'pr_merged' | 'file_changed';
  actor: string;
  actorAvatarUrl?: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const fetcher = async (url: string): Promise<ActivityEvent[]> => {
  return apiClient.get<ActivityEvent[]>(url);
};

export function useActivity(projectId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    projectId ? `/projects/${projectId}/activity` : null,
    fetcher
  );

  return {
    activities: data ?? [],
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  };
}
