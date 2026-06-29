'use client';

import useSWR from 'swr';

import { apiClient } from '@/lib/api';

export interface Comment {
  id: string;
  projectId: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  parentId?: string;
  replies?: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentInput {
  content: string;
  parentId?: string;
  targetType?: string;
  targetId?: string;
}

export interface UpdateCommentInput {
  content: string;
}

const fetcher = async (url: string): Promise<Comment[]> => {
  return apiClient.get<Comment[]>(url);
};

export function useComments(projectId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    projectId ? `/projects/${projectId}/comments` : null,
    fetcher
  );

  const createComment = async (input: CreateCommentInput) => {
    const result = await apiClient.post<Comment>(
      `/projects/${projectId}/comments`,
      input
    );
    await mutate();
    return result;
  };

  const updateComment = async (commentId: string, input: UpdateCommentInput) => {
    const result = await apiClient.patch<Comment>(
      `/projects/${projectId}/comments/${commentId}`,
      input
    );
    await mutate();
    return result;
  };

  const deleteComment = async (commentId: string) => {
    await apiClient.delete(`/projects/${projectId}/comments/${commentId}`);
    await mutate();
  };

  return {
    comments: data ?? [],
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
    createComment,
    updateComment,
    deleteComment,
  };
}
