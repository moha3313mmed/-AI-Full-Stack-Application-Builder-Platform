'use client';

import { AlertCircle, CheckCircle2, Circle, Loader2, Rocket, RotateCcw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { Deployment } from '@/hooks/useDeployments';

const STATUS_CONFIG = {
  pending: { icon: Circle, label: 'Pending', variant: 'secondary' as const },
  building: { icon: Loader2, label: 'Building', variant: 'default' as const },
  deploying: { icon: Rocket, label: 'Deploying', variant: 'default' as const },
  deployed: { icon: CheckCircle2, label: 'Deployed', variant: 'default' as const },
  failed: { icon: AlertCircle, label: 'Failed', variant: 'destructive' as const },
  rolled_back: { icon: RotateCcw, label: 'Rolled Back', variant: 'secondary' as const },
};

const STAGES = ['pending', 'building', 'deploying', 'deployed'] as const;

interface DeploymentStatusProps {
  deployment: Deployment;
}

export function DeploymentStatus({ deployment }: DeploymentStatusProps) {
  const config = STATUS_CONFIG[deployment.status];
  const Icon = config.icon;
  const isAnimating = deployment.status === 'building' || deployment.status === 'deploying';
  const currentStageIndex = STAGES.indexOf(
    deployment.status as (typeof STAGES)[number]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${isAnimating ? 'animate-spin' : ''}`} />
        <Badge variant={config.variant}>{config.label}</Badge>
        {deployment.environment && (
          <Badge variant="outline" className="text-[10px]">
            {deployment.environment}
          </Badge>
        )}
      </div>

      {/* Progress stages */}
      {deployment.status !== 'failed' && deployment.status !== 'rolled_back' && (
        <div className="flex items-center gap-1">
          {STAGES.map((stage, index) => (
            <div key={stage} className="flex flex-1 items-center">
              <div
                className={`h-1.5 w-full rounded-full ${
                  index <= currentStageIndex
                    ? 'bg-primary'
                    : 'bg-muted'
                }`}
              />
            </div>
          ))}
        </div>
      )}

      {deployment.url && (
        <a
          href={deployment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary underline"
        >
          {deployment.url}
        </a>
      )}

      {deployment.error && (
        <p className="text-xs text-destructive">{deployment.error}</p>
      )}
    </div>
  );
}
