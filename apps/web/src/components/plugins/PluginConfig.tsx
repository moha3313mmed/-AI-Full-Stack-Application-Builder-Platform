'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PluginConfigProps {
  pluginId: string;
  config: Record<string, unknown>;
  onSave: (pluginId: string, config: Record<string, unknown>) => void;
}

interface ConfigEntry {
  key: string;
  value: string;
}

export function PluginConfig({ pluginId, config, onSave }: PluginConfigProps) {
  const [entries, setEntries] = useState<ConfigEntry[]>(
    Object.entries(config).map(([key, value]) => ({
      key,
      value: String(value),
    }))
  );

  const addEntry = () => {
    setEntries([...entries, { key: '', value: '' }]);
  };

  const removeEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: val };
    setEntries(updated);
  };

  const handleSave = () => {
    const configObj: Record<string, unknown> = {};
    entries.forEach((entry) => {
      if (entry.key.trim()) {
        configObj[entry.key.trim()] = entry.value;
      }
    });
    onSave(pluginId, configObj);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Plugin Configuration</CardTitle>
        <Button variant="ghost" size="sm" onClick={addEntry}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No configuration entries. Click Add to create one.
          </p>
        ) : (
          entries.map((entry, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Key</Label>
                <Input
                  value={entry.key}
                  onChange={(e) => updateEntry(index, 'key', e.target.value)}
                  placeholder="config_key"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Value</Label>
                <Input
                  value={entry.value}
                  onChange={(e) => updateEntry(index, 'value', e.target.value)}
                  placeholder="value"
                  className="h-8 text-xs"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-destructive hover:text-destructive"
                onClick={() => removeEntry(index)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
        <Button onClick={handleSave} className="w-full" size="sm">
          Save Configuration
        </Button>
      </CardContent>
    </Card>
  );
}
