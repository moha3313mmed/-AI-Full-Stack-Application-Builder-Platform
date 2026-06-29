'use client';

import type { ProjectSummary } from '@builder/shared';
import useSWR from 'swr';

import { apiClient } from '@/lib/api';

const fetcher = (url: string) => apiClient.get<ProjectSummary[]>(url);

export function useProjects() {
  const { data, error, isLoading, mutate } = useSWR('/projects', fetcher);

  return {
    projects: data ?? [],
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  };
}

export function useProject(id: string) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/projects/${id}` : null,
    (url: string) => apiClient.get<ProjectSummary>(url)
  );

  return {
    project: data ?? null,
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
  };
}
