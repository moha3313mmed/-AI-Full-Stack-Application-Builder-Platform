'use client';

import { GitBranch as GitBranchIcon, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { BranchList } from '@/components/git/BranchList';
import { CommitHistory } from '@/components/git/CommitHistory';
import { CreateBranchDialog } from '@/components/git/CreateBranchDialog';
import { PullRequestCard } from '@/components/git/PullRequestCard';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGitRepository, type CreateBranchInput } from '@/hooks/useGitRepository';

interface GitPanelProps {
  projectId: string;
}

export function GitPanel({ projectId }: GitPanelProps) {
  const { repository, branches, commits, pullRequests, isLoading, createBranch, refresh } =
    useGitRepository(projectId);
  const [activeTab, setActiveTab] = useState<string>('branches');
  const [createBranchOpen, setCreateBranchOpen] = useState(false);

  const handleCreateBranch = async (input: CreateBranchInput) => {
    await createBranch(input);
    setCreateBranchOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <span className="text-sm">Loading repository...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Repo info bar */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <GitBranchIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">
          {repository?.currentBranch || 'main'}
        </span>
        {repository?.provider && (
          <span className="text-[10px] text-muted-foreground">
            ({repository.provider})
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setCreateBranchOpen(true)}
            title="New branch"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => refresh()}
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <TabsList className="h-8 w-full justify-start rounded-none border-b bg-transparent px-2 shrink-0">
          <TabsTrigger value="branches" className="text-[10px]">
            Branches
          </TabsTrigger>
          <TabsTrigger value="commits" className="text-[10px]">
            Commits
          </TabsTrigger>
          <TabsTrigger value="prs" className="text-[10px]">
            Pull Requests
          </TabsTrigger>
        </TabsList>
        <TabsContent value="branches" className="flex-1 overflow-hidden mt-0">
          <BranchList branches={branches} />
        </TabsContent>
        <TabsContent value="commits" className="flex-1 overflow-hidden mt-0">
          <CommitHistory commits={commits} />
        </TabsContent>
        <TabsContent value="prs" className="flex-1 overflow-hidden mt-0">
          <ScrollArea className="h-full">
            <div className="space-y-2 p-2">
              {pullRequests.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-4">
                  No pull requests
                </p>
              ) : (
                pullRequests.map((pr) => (
                  <PullRequestCard key={pr.id} pullRequest={pr} />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <CreateBranchDialog
        open={createBranchOpen}
        onOpenChange={setCreateBranchOpen}
        onSubmit={handleCreateBranch}
        branches={branches}
      />
    </div>
  );
}
