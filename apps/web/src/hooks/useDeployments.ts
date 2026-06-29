'use client';

import useSWR from 'swr';

import { apiClient } from '@/lib/api';

export interface Deployment {
  id: string;
  projectId: string;
  provider: string;
  status: 'pending' | 'building' | 'deploying' | 'deployed' | 'failed' | 'rolled_back';
  url?: string;
  commitSha?: string;
  branch?: string;
  environment: string;
  buildLogs?: string;
  error?: string;
  duration?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentConfig {
  provider: string;
  environment: string;
  branch?: string;
  envVars?: Record<string, string>;
  buildCommand?: string;
  outputDir?: string;
  autoRollback?: boolean;
}

export interface TriggerDeployInput {
  provider: string;
  environment: string;
  branch?: string;
  envVars?: Record<string, string>;
  buildCommand?: string;
  outputDir?: string;
}

const fetcher = async (url: string): Promise<Deployment[]> => {
  return apiClient.get<Deployment[]>(url);
};

export function useDeployments(projectId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    projectId ? `/projects/${projectId}/deployments` : null,
    fetcher
  );

  const triggerDeployment = async (input: TriggerDeployInput) => {
    const result = await apiClient.post<Deployment>(
      `/deployments`,
      { ...input, projectId }
    );
    await mutate();
    return result;
  };

  const rollback = async (deploymentId: string) => {
    const result = await apiClient.post<Deployment>(
      `/deployments/${deploymentId}/rollback`
    );
    await mutate();
    return result;
  };

  const getDeployment = async (deploymentId: string) => {
    return apiClient.get<Deployment>(
      `/deployments/${deploymentId}`
    );
  };

  return {
    deployments: data ?? [],
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
    triggerDeployment,
    rollback,
    getDeployment,
  };
}
