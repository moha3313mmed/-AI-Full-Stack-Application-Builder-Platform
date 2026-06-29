'use client';

import useSWR from 'swr';

import type { FileNode } from '@/components/editor/FileExplorer';
import { apiClient } from '@/lib/api';

async function fetchFileTree(projectId: string): Promise<FileNode[]> {
  return apiClient.get<FileNode[]>(`/projects/${projectId}/files/tree`);
}

export function useProjectFiles(projectId: string) {
  const { data, error, isLoading, mutate } = useSWR<FileNode[]>(
    projectId ? `/projects/${projectId}/files/tree` : null,
    () => fetchFileTree(projectId),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  return {
    files: data ?? [],
    isLoading,
    error,
    mutate,
  };
}
