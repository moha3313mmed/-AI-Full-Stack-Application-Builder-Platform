'use client';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Plugin } from '@/hooks/usePlugins';

interface PluginDetailsProps {
  plugin: Plugin;
}

export function PluginDetails({ plugin }: PluginDetailsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{plugin.name}</CardTitle>
            <CardDescription>v{plugin.version} by {plugin.author}</CardDescription>
          </div>
          <Badge className="text-xs">
            {plugin.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-1">Description</h4>
          <p className="text-sm text-muted-foreground">{plugin.description}</p>
        </div>

        <Separator />

        <div>
          <h4 className="text-sm font-medium mb-2">Permissions</h4>
          <div className="flex flex-wrap gap-1">
            {plugin.permissions.length > 0 ? (
              plugin.permissions.map((permission) => (
                <Badge key={permission} variant="outline" className="text-xs">
                  {permission}
                </Badge>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No permissions required</p>
            )}
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="text-sm font-medium mb-2">Hooks</h4>
          <div className="flex flex-wrap gap-1">
            {plugin.hooks.length > 0 ? (
              plugin.hooks.map((hook) => (
                <Badge key={hook} variant="secondary" className="text-xs">
                  {hook}
                </Badge>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No hooks registered</p>
            )}
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="text-sm font-medium mb-2">Configuration</h4>
          {Object.keys(plugin.config).length > 0 ? (
            <div className="space-y-1">
              {Object.entries(plugin.config).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs">{key}</span>
                  <span className="text-muted-foreground text-xs">
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No configuration</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
