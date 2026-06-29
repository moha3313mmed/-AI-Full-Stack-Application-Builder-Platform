'use client';

import { Pencil, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { MemoryEntry } from '@/hooks/useProjectMemory';

interface MemoryEntryCardProps {
  entry: MemoryEntry;
  onEdit?: (entry: MemoryEntry) => void;
  onDelete?: (entry: MemoryEntry) => void;
}

export function MemoryEntryCard({ entry, onEdit, onDelete }: MemoryEntryCardProps) {
  const formattedDate = new Date(entry.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold truncate">{entry.title}</h4>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {entry.category}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
            {entry.content}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {entry.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
            <span className="ml-auto text-[10px] text-muted-foreground">
              {formattedDate}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onEdit?.(entry)}
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={() => onDelete?.(entry)}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
