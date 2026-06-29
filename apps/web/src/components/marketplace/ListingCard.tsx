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
import type { MarketplaceListing } from '@/hooks/useMarketplace';

interface ListingCardProps {
  listing: MarketplaceListing;
  onInstall?: (id: string) => void;
}

export function ListingCard({ listing, onInstall }: ListingCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {listing.icon ? (
              <img src={listing.icon} alt="" className="h-6 w-6" />
            ) : (
              <span className="text-lg font-semibold">
                {listing.title.charAt(0)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm truncate">{listing.title}</CardTitle>
            <p className="text-xs text-muted-foreground truncate">
              {listing.author}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between">
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {listing.shortDescription}
        </p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              {listing.category}
            </Badge>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                {listing.rating.toFixed(1)}
              </span>
              <span className="flex items-center gap-0.5">
                <Download className="h-3 w-3" />
                {listing.downloads.toLocaleString()}
              </span>
            </div>
          </div>
          <Button
            className="w-full"
            size="sm"
            onClick={() => onInstall?.(listing.id)}
          >
            Install
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
