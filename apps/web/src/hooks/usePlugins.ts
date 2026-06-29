'use client';

import useSWR from 'swr';

import { apiClient } from '@/lib/api';

export type PluginStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'INSTALLED';

export type PluginCategory =
  | 'TOOLING'
  | 'INTEGRATION'
  | 'THEME'
  | 'LANGUAGE'
  | 'DEPLOYMENT'
  | 'SECURITY'
  | 'AI'
  | 'OTHER';

export interface Plugin {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  author: string;
  category: PluginCategory;
  status: PluginStatus;
  permissions: string[];
  hooks: string[];
  config: Record<string, unknown>;
  installedAt: string;
  updatedAt: string;
}

const fetcher = async (url: string): Promise<Plugin[]> => {
  return apiClient.get<Plugin[]>(url);
};

export function usePlugins() {
  const { data, error, isLoading, mutate } = useSWR(
    '/plugins',
    fetcher
  );

  const install = async (pluginId: string) => {
    const result = await apiClient.post<Plugin>(
      '/plugins/install',
      { pluginId }
    );
    await mutate();
    return result;
  };

  const activate = async (pluginId: string) => {
    const result = await apiClient.post<Plugin>(
      `/plugins/${pluginId}/activate`
    );
    await mutate();
    return result;
  };

  const deactivate = async (pluginId: string) => {
    const result = await apiClient.post<Plugin>(
      `/plugins/${pluginId}/deactivate`
    );
    await mutate();
    return result;
  };

  const uninstall = async (pluginId: string) => {
    await apiClient.delete(`/plugins/${pluginId}`);
    await mutate();
  };

  const updateConfig = async (pluginId: string, config: Record<string, unknown>) => {
    const result = await apiClient.patch<Plugin>(
      `/plugins/${pluginId}/config`,
      { config }
    );
    await mutate();
    return result;
  };

  return {
    plugins: data ?? [],
    isLoading,
    isError: !!error,
    error,
    install,
    activate,
    deactivate,
    uninstall,
    updateConfig,
  };
}
