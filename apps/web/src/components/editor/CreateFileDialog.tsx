'use client';

import { File, Folder } from 'lucide-react';
import { useCallback, useState } from 'react';

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
import { cn } from '@/lib/utils';

interface CreateFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { path: string; type: 'file' | 'directory' }) => void;
  basePath?: string;
}

export function CreateFileDialog({
  open,
  onOpenChange,
  onSubmit,
  basePath = '/',
}: CreateFileDialogProps) {
  const [filePath, setFilePath] = useState('');
  const [fileType, setFileType] = useState<'file' | 'directory'>('file');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!filePath.trim()) return;

      const fullPath = basePath.endsWith('/')
        ? `${basePath}${filePath}`
        : `${basePath}/${filePath}`;

      onSubmit({ path: fullPath, type: fileType });
      setFilePath('');
      onOpenChange(false);
    },
    [filePath, fileType, basePath, onSubmit, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New {fileType === 'file' ? 'File' : 'Directory'}</DialogTitle>
          <DialogDescription>
            Enter the path for the new {fileType === 'file' ? 'file' : 'directory'}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  'flex items-center gap-2',
                  fileType === 'file' && 'border-primary bg-primary/10'
                )}
                onClick={() => setFileType('file')}
              >
                <File className="h-4 w-4" />
                File
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  'flex items-center gap-2',
                  fileType === 'directory' && 'border-primary bg-primary/10'
                )}
                onClick={() => setFileType('directory')}
              >
                <Folder className="h-4 w-4" />
                Directory
              </Button>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="path">Path</Label>
              <Input
                id="path"
                placeholder={
                  fileType === 'file' ? 'src/components/MyComponent.tsx' : 'src/utils'
                }
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Base: {basePath}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!filePath.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
