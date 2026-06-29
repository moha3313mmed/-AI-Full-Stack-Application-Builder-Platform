'use client';

import { useState } from 'react';

import { PluginCard } from '@/components/plugins/PluginCard';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Plugin } from '@/hooks/usePlugins';

interface PluginListProps {
  plugins: Plugin[];
  isLoading?: boolean;
  onActivate?: (id: string) => void;
  onDeactivate?: (id: string) => void;
  onUninstall?: (id: string) => void;
}

export function PluginList({
  plugins,
  isLoading,
  onActivate,
  onDeactivate,
  onUninstall,
}: PluginListProps) {
  const [filter, setFilter] = useState<string>('all');

  const filteredPlugins = plugins.filter((plugin) => {
    if (filter === 'all') return true;
    if (filter === 'active') return plugin.status === 'ACTIVE';
    if (filter === 'inactive') return plugin.status === 'INACTIVE' || plugin.status === 'INSTALLED';
    return true;
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <div className="p-6">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-48 mb-4" />
              <Skeleton className="h-4 w-24" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Tabs value={filter} onValueChange={setFilter}>
      <TabsList>
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="inactive">Inactive</TabsTrigger>
      </TabsList>
      <TabsContent value={filter} className="mt-4">
        {filteredPlugins.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">
                No plugins found.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPlugins.map((plugin) => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                onActivate={onActivate}
                onDeactivate={onDeactivate}
                onUninstall={onUninstall}
              />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
