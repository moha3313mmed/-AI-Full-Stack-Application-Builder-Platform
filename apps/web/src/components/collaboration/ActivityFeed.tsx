'use client';

import {
  FileText,
  GitBranch,
  GitMerge,
  GitPullRequest,
  MessageSquare,
  Rocket,
  UserMinus,
  UserPlus,
} from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import type { ActivityEvent } from '@/hooks/useActivity';

const EVENT_ICONS: Record<string, typeof Rocket> = {
  commit: GitBranch,
  deploy: Rocket,
  comment: MessageSquare,
  member_joined: UserPlus,
  member_left: UserMinus,
  branch_created: GitBranch,
  pr_opened: GitPullRequest,
  pr_merged: GitMerge,
  file_changed: FileText,
};

interface ActivityFeedProps {
  activities: ActivityEvent[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">No activity yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-0.5 p-2">
        {activities.map((event) => {
          const Icon = EVENT_ICONS[event.type] || FileText;

          return (
            <div
              key={event.id}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs">
                  <span className="font-medium">{event.actor}</span>{' '}
                  <span className="text-muted-foreground">{event.description}</span>
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatActivityTime(event.createdAt)}
              </span>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function formatActivityTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d`;
}
