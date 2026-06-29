'use client';

import { useState } from 'react';

import { DeploymentConfig } from '@/components/deploy/DeploymentConfig';
import { DeploymentHistory } from '@/components/deploy/DeploymentHistory';
import { DeploymentStatus } from '@/components/deploy/DeploymentStatus';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDeployments, type Deployment, type TriggerDeployInput } from '@/hooks/useDeployments';

interface DeploymentPanelProps {
  projectId: string;
}

export function DeploymentPanel({ projectId }: DeploymentPanelProps) {
  const { deployments, isLoading, triggerDeployment } = useDeployments(projectId);
  const [activeTab, setActiveTab] = useState<string>('history');
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);

  const latestDeployment = deployments[0] || null;

  const handleDeploy = async (config: TriggerDeployInput) => {
    setIsDeploying(true);
    try {
      await triggerDeployment(config);
      setActiveTab('history');
    } finally {
      setIsDeploying(false);
    }
  };

  const handleSelectDeployment = (deployment: Deployment) => {
    setSelectedDeployment(deployment);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <span className="text-sm">Loading deployments...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Current status */}
      {(selectedDeployment || latestDeployment) && (
        <div className="border-b px-3 py-2">
          <DeploymentStatus deployment={(selectedDeployment || latestDeployment) as Deployment} />
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <TabsList className="h-8 w-full justify-start rounded-none border-b bg-transparent px-2 shrink-0">
          <TabsTrigger value="history" className="text-[10px]">
            History
          </TabsTrigger>
          <TabsTrigger value="configure" className="text-[10px]">
            Configure
          </TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="flex-1 overflow-hidden mt-0">
          <DeploymentHistory
            deployments={deployments}
            onSelect={handleSelectDeployment}
          />
        </TabsContent>
        <TabsContent value="configure" className="flex-1 overflow-hidden mt-0">
          <DeploymentConfig onDeploy={handleDeploy} isDeploying={isDeploying} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
