'use client';

import { FileText, GitCommit as GitCommitIcon } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import type { GitCommit } from '@/hooks/useGitRepository';

interface CommitHistoryProps {
  commits: GitCommit[];
}

export function CommitHistory({ commits }: CommitHistoryProps) {
  if (commits.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">No commits found</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-0.5 p-2">
        {commits.map((commit) => (
          <div
            key={commit.sha}
            className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
          >
            <GitCommitIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{commit.message}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {commit.author}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {commit.sha.slice(0, 7)}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <FileText className="h-2.5 w-2.5" />
                  {commit.filesChanged}
                </span>
                {(commit.additions > 0 || commit.deletions > 0) && (
                  <span className="text-[10px]">
                    <span className="text-green-600">+{commit.additions}</span>
                    <span className="text-red-600 ml-0.5">-{commit.deletions}</span>
                  </span>
                )}
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {formatCommitDate(commit.date)}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function formatCommitDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
