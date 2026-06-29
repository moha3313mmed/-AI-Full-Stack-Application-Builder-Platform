'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CreateBranchInput, GitBranch } from '@/hooks/useGitRepository';

interface CreateBranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateBranchInput) => void;
  branches: GitBranch[];
}

export function CreateBranchDialog({
  open,
  onOpenChange,
  onSubmit,
  branches,
}: CreateBranchDialogProps) {
  const [name, setName] = useState('');
  const [sourceBranch, setSourceBranch] = useState('');

  const defaultBranch = branches.find((b) => b.isDefault)?.name || 'main';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      sourceBranch: sourceBranch || defaultBranch,
    });
    setName('');
    setSourceBranch('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Branch</DialogTitle>
          <DialogDescription>
            Create a new branch from an existing one.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="branch-name" className="text-xs">
              Branch Name
            </Label>
            <Input
              id="branch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="feature/my-feature"
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source-branch" className="text-xs">
              From Branch
            </Label>
            <Input
              id="source-branch"
              value={sourceBranch}
              onChange={(e) => setSourceBranch(e.target.value)}
              placeholder={defaultBranch}
              className="text-sm"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
