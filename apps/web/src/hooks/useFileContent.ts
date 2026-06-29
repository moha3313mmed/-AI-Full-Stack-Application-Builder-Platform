'use client';

import useSWR from 'swr';

import { apiClient } from '@/lib/api';

interface FileContentResponse {
  path: string;
  content: string;
  language: string;
}

async function fetchFileContent(
  projectId: string,
  filePath: string
): Promise<FileContentResponse> {
  return apiClient.get<FileContentResponse>(
    `/projects/${projectId}/files/read`,
    { path: filePath }
  );
}

export function useFileContent(projectId: string, filePath: string | null) {
  const { data, error, isLoading, mutate } = useSWR<FileContentResponse>(
    projectId && filePath
      ? `/projects/${projectId}/files/read?path=${filePath}`
      : null,
    () => fetchFileContent(projectId, filePath as string),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  return {
    content: data?.content ?? '',
    language: data?.language ?? 'plaintext',
    isLoading,
    error,
    mutate,
  };
}
