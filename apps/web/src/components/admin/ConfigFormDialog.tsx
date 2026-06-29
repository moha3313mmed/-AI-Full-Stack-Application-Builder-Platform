'use client';

import { Eye, EyeOff, Loader2 } from 'lucide-react';
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
import { apiClient } from '@/lib/api';

interface ConfigItem {
  id?: string;
  category: string;
  key: string;
  value?: string;
  displayName: string;
  description?: string;
  isSecret?: boolean;
}

interface ConfigFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ConfigItem | null;
  category: string;
  onSuccess: () => void;
  onCancel: () => void;
  defaultIsSecret?: boolean;
}

export function ConfigFormDialog({
  open,
  onOpenChange,
  config,
  category,
  onSuccess,
  onCancel,
  defaultIsSecret = true,
}: ConfigFormDialogProps) {
  const [value, setValue] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [isSecret, setIsSecret] = useState(defaultIsSecret);
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = config?.id != null;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && config) {
      setDisplayName(config.displayName || '');
      setDescription(config.description || '');
      setValue('');
      setShowValue(false);
      setIsSecret(config.isSecret ?? defaultIsSecret);
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    if (!value.trim()) {
      setError('Value is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/admin/platform-config', {
        category,
        key: config.key,
        value: value.trim(),
        displayName: displayName.trim() || config.displayName,
        description: description.trim() || config.description || undefined,
        isSecret,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Update' : 'Configure'} {config?.displayName}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the value for this configuration entry. The previous value will be replaced.'
              : 'Set the value for this configuration entry. Secret values will be encrypted at rest.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="config-key">Key</Label>
            <Input
              id="config-key"
              value={config?.key || ''}
              disabled
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="config-display-name">Display Name</Label>
            <Input
              id="config-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={config?.displayName}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="config-description">Description</Label>
            <Input
              id="config-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={config?.description || 'Optional description'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="config-value">Value</Label>
            <div className="relative">
              <Input
                id="config-value"
                type={isSecret && !showValue ? 'password' : 'text'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={isEditing ? 'Enter new value to replace existing' : 'Enter value'}
                className="pr-10 font-mono text-sm"
              />
              {isSecret && (
                <button
                  type="button"
                  onClick={() => setShowValue(!showValue)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showValue ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
            {isSecret && (
              <p className="text-xs text-muted-foreground">
                Values are encrypted at rest and never exposed to the frontend.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="config-is-secret"
              type="checkbox"
              checked={isSecret}
              onChange={(e) => setIsSecret(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="config-is-secret" className="text-sm font-normal">
              Treat as secret (encrypt at rest)
            </Label>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
