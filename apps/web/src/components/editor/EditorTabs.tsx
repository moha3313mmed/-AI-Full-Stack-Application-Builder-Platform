'use client';

import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

interface EditorTab {
  path: string;
  name: string;
  isModified?: boolean;
}

interface EditorTabsProps {
  tabs: EditorTab[];
  activeTab?: string;
  onTabSelect: (path: string) => void;
  onTabClose: (path: string) => void;
}

export function EditorTabs({
  tabs,
  activeTab,
  onTabSelect,
  onTabClose,
}: EditorTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="border-b">
      <div className="flex overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.path}
            className={cn(
              'group flex items-center gap-2 border-r px-4 py-2 text-sm cursor-pointer shrink-0',
              activeTab === tab.path
                ? 'bg-background text-foreground'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onTabSelect(tab.path)}
          >
            <span className="truncate max-w-[120px]">{tab.name}</span>
            {tab.isModified && (
              <span className="h-2 w-2 rounded-full bg-primary" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.path);
              }}
              className="rounded p-0.5 opacity-0 hover:bg-accent group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
