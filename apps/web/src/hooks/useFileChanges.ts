'use client';

import { useEffect } from 'react';
import { useSWRConfig } from 'swr';

import { filesWsClient } from '@/lib/websocket';

interface FileChangeEvent {
  projectId: string;
  path: string;
  type: 'created' | 'updated' | 'deleted' | 'moved';
  newPath?: string;
}

export function useFileChanges(projectId: string) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!projectId) return;

    // Ensure the /files namespace socket is connected
    if (!filesWsClient.isConnected) {
      filesWsClient.connect();
    }

    // Subscribe to the project room on the server
    filesWsClient.send('file:subscribe', { projectId });

    const handleFileCreated = (data: unknown) => {
      const event = data as FileChangeEvent;
      if (event.projectId === projectId) {
        mutate(`/projects/${projectId}/files/tree`);
      }
    };

    const handleFileUpdated = (data: unknown) => {
      const event = data as FileChangeEvent;
      if (event.projectId === projectId) {
        mutate(
          (key: string) =>
            typeof key === 'string' &&
            key.startsWith(`/projects/${projectId}/files/read`),
          undefined,
          { revalidate: true },
        );
        mutate(`/projects/${projectId}/files/tree`);
      }
    };

    const handleFileDeleted = (data: unknown) => {
      const event = data as FileChangeEvent;
      if (event.projectId === projectId) {
        mutate(`/projects/${projectId}/files/tree`);
      }
    };

    const handleFileMoved = (data: unknown) => {
      const event = data as FileChangeEvent;
      if (event.projectId === projectId) {
        mutate(`/projects/${projectId}/files/tree`);
      }
    };

    const unsubCreated = filesWsClient.subscribe('file:created', handleFileCreated);
    const unsubUpdated = filesWsClient.subscribe('file:updated', handleFileUpdated);
    const unsubDeleted = filesWsClient.subscribe('file:deleted', handleFileDeleted);
    const unsubMoved = filesWsClient.subscribe('file:moved', handleFileMoved);

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
      unsubMoved();
    };
  }, [projectId, mutate]);
}
