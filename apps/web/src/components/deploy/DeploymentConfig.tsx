'use client';

import { Rocket } from 'lucide-react';
import { useState } from 'react';

import { EnvVarEditor } from '@/components/deploy/EnvVarEditor';
import { ProviderSelector } from '@/components/deploy/ProviderSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TriggerDeployInput } from '@/hooks/useDeployments';

interface EnvVar {
  key: string;
  value: string;
}

interface DeploymentConfigProps {
  onDeploy: (config: TriggerDeployInput) => void;
  isDeploying?: boolean;
}

export function DeploymentConfig({ onDeploy, isDeploying }: DeploymentConfigProps) {
  const [provider, setProvider] = useState<string>('');
  const [environment, setEnvironment] = useState<string>('production');
  const [branch, setBranch] = useState<string>('main');
  const [buildCommand, setBuildCommand] = useState<string>('npm run build');
  const [outputDir, setOutputDir] = useState<string>('dist');
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);

  const handleDeploy = () => {
    if (!provider || !environment) return;
    const envVarMap: Record<string, string> = {};
    envVars.forEach((v) => {
      if (v.key.trim()) {
        envVarMap[v.key.trim()] = v.value;
      }
    });
    onDeploy({
      provider,
      environment,
      branch: branch || undefined,
      buildCommand: buildCommand || undefined,
      outputDir: outputDir || undefined,
      envVars: Object.keys(envVarMap).length > 0 ? envVarMap : undefined,
    });
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-3">
        <div className="space-y-2">
          <Label className="text-xs">Provider</Label>
          <ProviderSelector value={provider} onChange={setProvider} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Environment</Label>
            <Input
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              placeholder="production"
              className="h-7 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Branch</Label>
            <Input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="h-7 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Build Command</Label>
            <Input
              value={buildCommand}
              onChange={(e) => setBuildCommand(e.target.value)}
              placeholder="npm run build"
              className="h-7 font-mono text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Output Directory</Label>
            <Input
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              placeholder="dist"
              className="h-7 font-mono text-xs"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Environment Variables</Label>
          <EnvVarEditor value={envVars} onChange={setEnvVars} />
        </div>

        <Button
          onClick={handleDeploy}
          disabled={!provider || !environment || isDeploying}
          className="w-full gap-1.5 text-xs"
          size="sm"
        >
          <Rocket className="h-3.5 w-3.5" />
          {isDeploying ? 'Deploying...' : 'Deploy'}
        </Button>
      </div>
    </ScrollArea>
  );
}
