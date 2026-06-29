'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { TeamMember } from '@/hooks/useTeam';

interface PresenceIndicatorProps {
  members: TeamMember[];
  maxVisible?: number;
}

export function PresenceIndicator({ members, maxVisible = 5 }: PresenceIndicatorProps) {
  // Show members who were active recently (within last 5 minutes)
  const now = new Date();
  const activeMembers = members.filter((m) => {
    if (!m.lastActiveAt) return false;
    const lastActive = new Date(m.lastActiveAt);
    return now.getTime() - lastActive.getTime() < 5 * 60 * 1000;
  });

  const visibleMembers = activeMembers.slice(0, maxVisible);
  const overflowCount = activeMembers.length - maxVisible;

  if (activeMembers.length === 0) {
    return (
      <span className="text-[10px] text-muted-foreground">No one online</span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-1.5">
        {visibleMembers.map((member) => {
          const initials = member.username
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
          return (
            <Avatar key={member.id} className="h-5 w-5 border-2 border-background">
              <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
            </Avatar>
          );
        })}
      </div>
      {overflowCount > 0 && (
        <span className="text-[10px] text-muted-foreground">+{overflowCount}</span>
      )}
      <span className="text-[10px] text-muted-foreground">
        {activeMembers.length} online
      </span>
    </div>
  );
}
