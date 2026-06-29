'use client';

import { Cloud, Globe, Server, Zap } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Deployment } from '@/hooks/useDeployments';

const PROVIDER_ICONS: Record<string, typeof Cloud> = {
  vercel: Zap,
  netlify: Globe,
  aws: Cloud,
  docker: Server,
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive'> = {
  pending: 'secondary',
  building: 'default',
  deploying: 'default',
  deployed: 'default',
  failed: 'destructive',
  rolled_back: 'secondary',
};

interface DeploymentHistoryProps {
  deployments: Deployment[];
  onSelect?: (deployment: Deployment) => void;
}

export function DeploymentHistory({ deployments, onSelect }: DeploymentHistoryProps) {
  if (deployments.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">No deployments yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {deployments.map((deployment) => {
          const Icon = PROVIDER_ICONS[deployment.provider] || Cloud;
          const timeAgo = formatTimeAgo(deployment.createdAt);

          return (
            <button
              key={deployment.id}
              type="button"
              onClick={() => onSelect?.(deployment)}
              className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-accent transition-colors"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium truncate">
                    {deployment.environment}
                  </span>
                  <Badge
                    variant={STATUS_VARIANTS[deployment.status] || 'secondary'}
                    className="text-[9px] px-1 py-0"
                  >
                    {deployment.status}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  {deployment.commitSha?.slice(0, 7)}{' '}
                  {deployment.branch && `on ${deployment.branch}`}
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {timeAgo}
              </span>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}
