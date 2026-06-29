'use client';

import { cn } from '@/lib/utils';

export type DeviceSize = 'mobile' | 'tablet' | 'desktop';

interface DeviceFrameProps {
  size: DeviceSize;
  children: React.ReactNode;
}

const deviceDimensions: Record<DeviceSize, { width: number; label: string }> = {
  mobile: { width: 375, label: 'Mobile' },
  tablet: { width: 768, label: 'Tablet' },
  desktop: { width: 1024, label: 'Desktop' },
};

export function DeviceFrame({ size, children }: DeviceFrameProps) {
  const { width } = deviceDimensions[size];

  return (
    <div className="flex h-full items-start justify-center overflow-auto bg-muted/30 p-4">
      <div
        className={cn(
          'relative flex flex-col overflow-hidden rounded-lg border bg-background shadow-sm',
          size === 'mobile' && 'rounded-[2rem]',
          size === 'desktop' && 'w-full max-w-full'
        )}
        style={{
          width: size === 'desktop' ? '100%' : `${width}px`,
          maxWidth: '100%',
          height: '100%',
        }}
      >
        {size === 'mobile' && (
          <div className="flex h-6 items-center justify-center bg-border">
            <div className="h-1.5 w-16 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
