'use client';

import { PluginList } from '@/components/plugins/PluginList';
import { usePlugins } from '@/hooks/usePlugins';

export default function PluginsPage() {
  const { plugins, isLoading, activate, deactivate, uninstall } = usePlugins();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Installed Plugins</h1>
        <p className="text-muted-foreground">
          Manage your installed plugins and their configurations.
        </p>
      </div>

      <PluginList
        plugins={plugins}
        isLoading={isLoading}
        onActivate={activate}
        onDeactivate={deactivate}
        onUninstall={uninstall}
      />
    </div>
  );
}
