'use client';

import { Check, GitBranch as GitBranchIcon, Star } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GitBranch } from '@/hooks/useGitRepository';

interface BranchListProps {
  branches: GitBranch[];
}

export function BranchList({ branches }: BranchListProps) {
  if (branches.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">No branches found</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-0.5 p-2">
        {branches.map((branch) => (
          <div
            key={branch.name}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
          >
            <GitBranchIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-xs font-medium truncate">{branch.name}</span>
            {branch.isCurrent && (
              <Badge variant="default" className="text-[9px] px-1 py-0 gap-0.5">
                <Check className="h-2.5 w-2.5" />
                current
              </Badge>
            )}
            {branch.isDefault && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 gap-0.5">
                <Star className="h-2.5 w-2.5" />
                default
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground shrink-0">
              {branch.lastCommitSha?.slice(0, 7)}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
