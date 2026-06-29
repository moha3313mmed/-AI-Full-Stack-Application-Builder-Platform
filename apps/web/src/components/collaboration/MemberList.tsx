'use client';

import { MoreHorizontal, Shield, ShieldCheck, User } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { TeamMember, UpdateMemberRoleInput } from '@/hooks/useTeam';

const ROLE_ICONS: Record<string, typeof Shield> = {
  owner: ShieldCheck,
  admin: Shield,
  member: User,
  viewer: User,
};

const ROLE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
  viewer: 'outline',
};

interface MemberListProps {
  members: TeamMember[];
  onUpdateRole: (memberId: string, input: UpdateMemberRoleInput) => void;
  onRemove: (memberId: string) => void;
}

export function MemberList({ members, onUpdateRole, onRemove }: MemberListProps) {
  if (members.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs text-muted-foreground">No team members</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {members.map((member) => {
          const RoleIcon = ROLE_ICONS[member.role] || User;
          const initials = member.username
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

          return (
            <div
              key={member.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium truncate">{member.username}</span>
                  <Badge
                    variant={ROLE_VARIANTS[member.role]}
                    className="text-[9px] px-1 py-0 gap-0.5"
                  >
                    <RoleIcon className="h-2.5 w-2.5" />
                    {member.role}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{member.email}</p>
              </div>
              {member.role !== 'owner' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => onUpdateRole(member.id, { role: 'admin' })}
                    >
                      Make Admin
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onUpdateRole(member.id, { role: 'member' })}
                    >
                      Make Member
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onUpdateRole(member.id, { role: 'viewer' })}
                    >
                      Make Viewer
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onRemove(member.id)}
                    >
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
