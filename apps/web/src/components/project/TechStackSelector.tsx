'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface TechOption {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

interface TechStackSelectorProps {
  title: string;
  options: TechOption[];
  selected: string | null;
  onSelect: (id: string) => void;
  multiple?: boolean;
  selectedMultiple?: string[];
  onSelectMultiple?: (ids: string[]) => void;
}

export function TechStackSelector({
  title,
  options,
  selected,
  onSelect,
  multiple = false,
  selectedMultiple = [],
  onSelectMultiple,
}: TechStackSelectorProps) {
  const handleClick = (id: string) => {
    if (multiple && onSelectMultiple) {
      const isSelected = selectedMultiple.includes(id);
      if (isSelected) {
        onSelectMultiple(selectedMultiple.filter((s) => s !== id));
      } else {
        onSelectMultiple([...selectedMultiple, id]);
      }
    } else {
      onSelect(id);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">{title}</h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {options.map((option) => {
          const isSelected = multiple
            ? selectedMultiple.includes(option.id)
            : selected === option.id;
          return (
            <Card
              key={option.id}
              className={cn(
                'cursor-pointer transition-colors',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'hover:border-primary/50'
              )}
              onClick={() => handleClick(option.id)}
            >
              <CardContent className="p-4">
                <p className="text-sm font-medium">{option.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {option.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
