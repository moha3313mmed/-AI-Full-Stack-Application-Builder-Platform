'use client';

import { Pause, Play, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Plugin, PluginStatus } from '@/hooks/usePlugins';
import { cn } from '@/lib/utils';

interface PluginCardProps {
  plugin: Plugin;
  onActivate?: (id: string) => void;
  onDeactivate?: (id: string) => void;
  onUninstall?: (id: string) => void;
}

function getStatusColor(status: PluginStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'INACTIVE':
    case 'INSTALLED':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'ERROR':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function PluginCard({ plugin, onActivate, onDeactivate, onUninstall }: PluginCardProps) {
  const isActive = plugin.status === 'ACTIVE';

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base">{plugin.name}</CardTitle>
          <p className="text-xs text-muted-foreground">v{plugin.version}</p>
        </div>
        <Badge className={cn('text-xs', getStatusColor(plugin.status))}>
          {plugin.status}
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">{plugin.description}</p>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">
            {plugin.category}
          </Badge>
          <div className="flex items-center gap-1">
            {isActive ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => onDeactivate?.(plugin.id)}
              >
                <Pause className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => onActivate?.(plugin.id)}
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive"
              onClick={() => onUninstall?.(plugin.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
