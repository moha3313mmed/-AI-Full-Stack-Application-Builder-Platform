'use client';

import { AlertCircle, Loader2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { DeviceFrame, type DeviceSize } from './DeviceFrame';
import { PreviewToolbar } from './PreviewToolbar';

interface LivePreviewProps {
  projectId: string;
}

export function LivePreview({ projectId }: LivePreviewProps) {
  const [deviceSize, setDeviceSize] = useState<DeviceSize>('desktop');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const previewUrl =
    process.env.NEXT_PUBLIC_PREVIEW_URL ||
    `http://localhost:3002/preview/${projectId}`;

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleIframeError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <PreviewToolbar
        deviceSize={deviceSize}
        onDeviceSizeChange={setDeviceSize}
        onRefresh={handleRefresh}
        previewUrl={previewUrl}
      />

      <div className="relative flex-1 overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Loading preview...
              </p>
            </div>
          </div>
        )}

        {hasError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-2 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm font-medium">Preview unavailable</p>
              <p className="text-xs text-muted-foreground">
                The preview server is not responding. Build your project to see
                a live preview.
              </p>
            </div>
          </div>
        )}

        <DeviceFrame size={deviceSize}>
          <iframe
            key={refreshKey}
            ref={iframeRef}
            src={previewUrl}
            className="h-full w-full border-0"
            title="Project Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        </DeviceFrame>
      </div>
    </div>
  );
}
