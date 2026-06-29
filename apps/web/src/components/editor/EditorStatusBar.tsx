'use client';

import { cn } from '@/lib/utils';

interface EditorStatusBarProps {
  language: string;
  line?: number;
  column?: number;
  encoding?: string;
  saveStatus?: 'saved' | 'unsaved' | 'saving';
}

export function EditorStatusBar({
  language,
  line = 1,
  column = 1,
  encoding = 'UTF-8',
  saveStatus = 'saved',
}: EditorStatusBarProps) {
  return (
    <div className="flex items-center justify-between border-t bg-muted/50 px-4 py-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <span>
          Ln {line}, Col {column}
        </span>
        <span>{encoding}</span>
      </div>
      <div className="flex items-center gap-4">
        <span
          className={cn(
            saveStatus === 'unsaved' && 'text-yellow-500',
            saveStatus === 'saving' && 'text-blue-500'
          )}
        >
          {saveStatus === 'saved' && 'Saved'}
          {saveStatus === 'unsaved' && 'Unsaved changes'}
          {saveStatus === 'saving' && 'Saving...'}
        </span>
        <span className="capitalize">{language}</span>
      </div>
    </div>
  );
}
