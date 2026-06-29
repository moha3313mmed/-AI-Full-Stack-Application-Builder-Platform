'use client';

import {
  ExternalLink,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { DeviceSize } from './DeviceFrame';

interface PreviewToolbarProps {
  deviceSize: DeviceSize;
  onDeviceSizeChange: (size: DeviceSize) => void;
  onRefresh: () => void;
  previewUrl: string;
}

const devices: { size: DeviceSize; icon: typeof Smartphone; label: string }[] = [
  { size: 'mobile', icon: Smartphone, label: 'Mobile (375px)' },
  { size: 'tablet', icon: Tablet, label: 'Tablet (768px)' },
  { size: 'desktop', icon: Monitor, label: 'Desktop (1024px)' },
];

export function PreviewToolbar({
  deviceSize,
  onDeviceSizeChange,
  onRefresh,
  previewUrl,
}: PreviewToolbarProps) {
  return (
    <div className="flex items-center gap-2 border-b px-3 py-2">
      <div className="flex items-center gap-1">
        {devices.map(({ size, icon: Icon, label }) => (
          <Button
            key={size}
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 w-7 p-0',
              deviceSize === size && 'bg-accent text-accent-foreground'
            )}
            onClick={() => onDeviceSizeChange(size)}
            title={label}
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <div className="mx-2 flex-1 truncate rounded-sm bg-muted px-3 py-1 text-xs text-muted-foreground">
        {previewUrl}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onRefresh}
          title="Refresh preview"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => window.open(previewUrl, '_blank')}
          title="Open in new tab"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
