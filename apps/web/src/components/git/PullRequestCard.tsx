'use client';

import { GitMerge, GitPullRequest } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { PullRequest } from '@/hooks/useGitRepository';

const STATUS_CONFIG = {
  open: { icon: GitPullRequest, variant: 'default' as const, className: 'text-green-600' },
  closed: { icon: GitPullRequest, variant: 'secondary' as const, className: 'text-red-600' },
  merged: { icon: GitMerge, variant: 'default' as const, className: 'text-purple-600' },
};

interface PullRequestCardProps {
  pullRequest: PullRequest;
}

export function PullRequestCard({ pullRequest }: PullRequestCardProps) {
  const config = STATUS_CONFIG[pullRequest.status];
  const Icon = config.icon;

  return (
    <div className="rounded-md border p-2 hover:bg-accent/50 transition-colors">
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${config.className}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium truncate">{pullRequest.title}</span>
            <Badge variant={config.variant} className="text-[9px] px-1 py-0">
              {pullRequest.status}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-muted-foreground">
              #{pullRequest.number}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {pullRequest.sourceBranch} &rarr; {pullRequest.targetBranch}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-muted-foreground">
              by {pullRequest.author}
            </span>
            {pullRequest.reviewers.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                reviewers: {pullRequest.reviewers.join(', ')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
