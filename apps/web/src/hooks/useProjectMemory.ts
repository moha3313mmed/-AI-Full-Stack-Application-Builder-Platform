'use client';

import useSWR from 'swr';

import { apiClient } from '@/lib/api';

export interface MemoryEntry {
  id: string;
  projectId: string;
  category: string;
  title: string;
  content: string;
  tags: string[];
  metadata: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoryInput {
  category: string;
  title: string;
  content: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateMemoryInput {
  title?: string;
  content?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface MemoryListResponse {
  items: MemoryEntry[];
  total: number;
}

const fetcher = async (url: string): Promise<MemoryEntry[]> => {
  const response = await apiClient.get<MemoryListResponse>(url);
  return response.items;
};

export function useProjectMemory(projectId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    projectId ? `/projects/${projectId}/memory` : null,
    fetcher
  );

  const createEntry = async (input: CreateMemoryInput) => {
    const result = await apiClient.post<MemoryEntry>(
      `/projects/${projectId}/memory`,
      input
    );
    await mutate();
    return result;
  };

  const updateEntry = async (id: string, input: UpdateMemoryInput) => {
    const result = await apiClient.patch<MemoryEntry>(
      `/projects/${projectId}/memory/${id}`,
      input
    );
    await mutate();
    return result;
  };

  const deleteEntry = async (id: string) => {
    await apiClient.delete(`/projects/${projectId}/memory/${id}`);
    await mutate();
  };

  return {
    entries: data ?? [],
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
    createEntry,
    updateEntry,
    deleteEntry,
  };
}
