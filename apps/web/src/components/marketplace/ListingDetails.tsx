'use client';

import { Download, Star } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { MarketplaceListing } from '@/hooks/useMarketplace';

interface ListingDetailsProps {
  listing: MarketplaceListing;
  onInstall?: (id: string) => void;
  isInstalled?: boolean;
  onUninstall?: (id: string) => void;
}

export function ListingDetails({
  listing,
  onInstall,
  isInstalled,
  onUninstall,
}: ListingDetailsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            {listing.icon ? (
              <img src={listing.icon} alt="" className="h-8 w-8" />
            ) : (
              <span className="text-2xl font-semibold">
                {listing.title.charAt(0)}
              </span>
            )}
          </div>
          <div className="flex-1">
            <CardTitle className="text-xl">{listing.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{listing.author}</p>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="outline">{listing.category}</Badge>
              <span className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                {listing.rating.toFixed(1)} ({listing.reviewCount} reviews)
              </span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Download className="h-4 w-4" />
                {listing.downloads.toLocaleString()} downloads
              </span>
            </div>
          </div>
          <div>
            {isInstalled ? (
              <Button
                variant="destructive"
                onClick={() => onUninstall?.(listing.id)}
              >
                Uninstall
              </Button>
            ) : (
              <Button onClick={() => onInstall?.(listing.id)}>
                Install
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Description</h4>
          <p className="text-sm text-muted-foreground">{listing.description}</p>
        </div>

        <Separator />

        <div>
          <h4 className="text-sm font-medium mb-2">Tags</h4>
          <div className="flex flex-wrap gap-1">
            {listing.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="text-sm font-medium mb-2">Screenshots</h4>
          {listing.screenshots.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {listing.screenshots.map((url, index) => (
                <div
                  key={index}
                  className="aspect-video rounded-md border bg-muted flex items-center justify-center"
                >
                  <img
                    src={url}
                    alt={`Screenshot ${index + 1}`}
                    className="rounded-md object-cover w-full h-full"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="aspect-video rounded-md border bg-muted flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No screenshots available</p>
            </div>
          )}
        </div>

        <Separator />

        <div>
          <h4 className="text-sm font-medium mb-1">Version</h4>
          <p className="text-sm text-muted-foreground">v{listing.version}</p>
        </div>
      </CardContent>
    </Card>
  );
}
