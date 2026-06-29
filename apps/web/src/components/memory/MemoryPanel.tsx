'use client';

import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AddMemoryDialog } from '@/components/memory/AddMemoryDialog';
import { MemoryEntryCard } from '@/components/memory/MemoryEntryCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectMemory } from '@/hooks/useProjectMemory';

const CATEGORIES = [
  { value: 'ARCHITECTURE', label: 'Architecture' },
  { value: 'CODING_STANDARDS', label: 'Coding Standards' },
  { value: 'USER_PREFERENCES', label: 'Preferences' },
  { value: 'FEATURE_HISTORY', label: 'Features' },
  { value: 'BUSINESS_RULES', label: 'Business Rules' },
  { value: 'DESIGN_LANGUAGE', label: 'Design Language' },
  { value: 'DATABASE_EVOLUTION', label: 'DB Evolution' },
  { value: 'DECISIONS', label: 'Decisions' },
] as const;

interface MemoryPanelProps {
  projectId: string;
}

export function MemoryPanel({ projectId }: MemoryPanelProps) {
  const { entries, isLoading, createEntry, deleteEntry } = useProjectMemory(projectId);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ARCHITECTURE');

  const filteredEntries = useMemo(() => {
    let filtered = entries.filter((e) => e.category === activeCategory);
    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          e.content.toLowerCase().includes(query) ||
          e.tags.some((t) => t.toLowerCase().includes(query))
      );
    }
    return filtered;
  }, [entries, activeCategory, search]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <span className="text-sm">Loading memory...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Search and Add */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search memory..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <AddMemoryDialog onSubmit={createEntry}>
          <Button size="sm" className="h-8 gap-1 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </AddMemoryDialog>
      </div>

      {/* Category Tabs */}
      <Tabs
        value={activeCategory}
        onValueChange={setActiveCategory}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <TabsList className="h-8 w-full justify-start rounded-none border-b bg-transparent px-2 shrink-0">
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.value} value={cat.value} className="text-[10px] px-2 py-1">
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {CATEGORIES.map((cat) => (
          <TabsContent key={cat.value} value={cat.value} className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="space-y-2 p-3">
                {filteredEntries.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-4">
                    No entries in {cat.label}
                  </p>
                ) : (
                  filteredEntries.map((entry) => (
                    <MemoryEntryCard
                      key={entry.id}
                      entry={entry}
                      onDelete={(e) => deleteEntry(e.id)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
