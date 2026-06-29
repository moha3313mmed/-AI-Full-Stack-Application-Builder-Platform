'use client';

import { UserPlus } from 'lucide-react';
import { useState } from 'react';

import { ActivityFeed } from '@/components/collaboration/ActivityFeed';
import { CommentThread } from '@/components/collaboration/CommentThread';
import { InviteMemberDialog } from '@/components/collaboration/InviteMemberDialog';
import { MemberList } from '@/components/collaboration/MemberList';
import { PresenceIndicator } from '@/components/collaboration/PresenceIndicator';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useActivity } from '@/hooks/useActivity';
import { useComments, type CreateCommentInput } from '@/hooks/useComments';
import { useTeam, type InviteMemberInput } from '@/hooks/useTeam';

interface TeamPanelProps {
  projectId: string;
  teamId?: string;
}

export function TeamPanel({ projectId, teamId }: TeamPanelProps) {
  const { members, isLoading: membersLoading, inviteMember, updateRole, removeMember } =
    useTeam(teamId || projectId);
  const { comments, isLoading: commentsLoading, createComment, deleteComment } =
    useComments(projectId);
  const { activities, isLoading: activitiesLoading } = useActivity(projectId);

  const [activeTab, setActiveTab] = useState<string>('members');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const handleInvite = async (input: InviteMemberInput) => {
    await inviteMember(input);
    setInviteDialogOpen(false);
  };

  const handleCreateComment = async (input: CreateCommentInput) => {
    await createComment(input);
  };

  const isLoading = membersLoading || commentsLoading || activitiesLoading;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <span className="text-sm">Loading team...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header with presence */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <PresenceIndicator members={members} />
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setInviteDialogOpen(true)}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invite
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <TabsList className="h-8 w-full justify-start rounded-none border-b bg-transparent px-2 shrink-0">
          <TabsTrigger value="members" className="text-[10px]">
            Members
          </TabsTrigger>
          <TabsTrigger value="comments" className="text-[10px]">
            Comments
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-[10px]">
            Activity
          </TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="flex-1 overflow-hidden mt-0">
          <MemberList
            members={members}
            onUpdateRole={updateRole}
            onRemove={removeMember}
          />
        </TabsContent>
        <TabsContent value="comments" className="flex-1 overflow-hidden mt-0">
          <CommentThread
            comments={comments}
            onCreateComment={handleCreateComment}
            onDeleteComment={deleteComment}
          />
        </TabsContent>
        <TabsContent value="activity" className="flex-1 overflow-hidden mt-0">
          <ActivityFeed activities={activities} />
        </TabsContent>
      </Tabs>

      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSubmit={handleInvite}
      />
    </div>
  );
}
