'use client';

import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface EnvVar {
  key: string;
  value: string;
}

interface EnvVarEditorProps {
  value: EnvVar[];
  onChange: (vars: EnvVar[]) => void;
}

export function EnvVarEditor({ value, onChange }: EnvVarEditorProps) {
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const toggleVisibility = (key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const addVar = () => {
    onChange([...value, { key: '', value: '' }]);
  };

  const updateVar = (index: number, field: 'key' | 'value', newValue: string) => {
    const updated = [...value];
    updated[index] = { ...updated[index], [field]: newValue };
    onChange(updated);
  };

  const removeVar = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {value.map((envVar, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <Input
            value={envVar.key}
            onChange={(e) => updateVar(index, 'key', e.target.value)}
            placeholder="KEY"
            className="h-7 flex-1 font-mono text-xs"
          />
          <div className="relative flex-1">
            <Input
              value={envVar.value}
              onChange={(e) => updateVar(index, 'value', e.target.value)}
              placeholder="value"
              type={visibleKeys.has(envVar.key) ? 'text' : 'password'}
              className="h-7 font-mono text-xs pr-7"
            />
            <button
              type="button"
              onClick={() => toggleVisibility(envVar.key)}
              className="absolute right-1.5 top-1.5 text-muted-foreground hover:text-foreground"
            >
              {visibleKeys.has(envVar.key) ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => removeVar(index)}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={addVar}>
        <Plus className="h-3 w-3" />
        Add Variable
      </Button>
    </div>
  );
}
