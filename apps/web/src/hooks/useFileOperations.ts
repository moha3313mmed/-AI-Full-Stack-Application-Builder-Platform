'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';

import { apiClient } from '@/lib/api';

interface CreateFileParams {
  path: string;
  content?: string;
  type?: 'file' | 'directory';
}

interface UpdateFileParams {
  path: string;
  content: string;
}

interface MoveFileParams {
  oldPath: string;
  newPath: string;
}

interface ScaffoldParams {
  framework: string;
  options?: Record<string, unknown>;
}

export function useFileOperations(projectId: string) {
  const { mutate } = useSWRConfig();

  const invalidateTree = useCallback(() => {
    mutate(`/projects/${projectId}/files/tree`);
  }, [mutate, projectId]);

  const createFile = useCallback(
    async (params: CreateFileParams) => {
      // For directories, create a .gitkeep placeholder file inside them
      // since the backend creates directories implicitly when files are created
      const payload = params.type === 'directory'
        ? { path: `${params.path.replace(/\/$/, '')}/.gitkeep`, content: '' }
        : { path: params.path, content: params.content ?? '' };

      const result = await apiClient.post(
        `/projects/${projectId}/files`,
        payload
      );
      invalidateTree();
      return result;
    },
    [projectId, invalidateTree]
  );

  const updateFile = useCallback(
    async (params: UpdateFileParams) => {
      const result = await apiClient.request(
        `/projects/${projectId}/files`,
        {
          method: 'PUT',
          params: { path: params.path },
          body: JSON.stringify({ content: params.content }),
        }
      );
      mutate(`/projects/${projectId}/files/read?path=${params.path}`);
      invalidateTree();
      return result;
    },
    [projectId, mutate, invalidateTree]
  );

  const deleteFile = useCallback(
    async (path: string) => {
      const result = await apiClient.request(
        `/projects/${projectId}/files`,
        {
          method: 'DELETE',
          params: { path },
        }
      );
      invalidateTree();
      return result;
    },
    [projectId, invalidateTree]
  );

  const moveFile = useCallback(
    async (params: MoveFileParams) => {
      const result = await apiClient.post(
        `/projects/${projectId}/files/move`,
        { from: params.oldPath, to: params.newPath }
      );
      invalidateTree();
      return result;
    },
    [projectId, invalidateTree]
  );

  const scaffoldProject = useCallback(
    async (params: ScaffoldParams) => {
      const result = await apiClient.post(
        `/projects/${projectId}/files/scaffold`,
        params
      );
      invalidateTree();
      return result;
    },
    [projectId, invalidateTree]
  );

  return {
    createFile,
    updateFile,
    deleteFile,
    moveFile,
    scaffoldProject,
  };
}
