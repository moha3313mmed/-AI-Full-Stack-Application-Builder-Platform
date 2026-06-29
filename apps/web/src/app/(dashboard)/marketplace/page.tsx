'use client';

import { useState } from 'react';

import { MarketplaceGrid } from '@/components/marketplace/MarketplaceGrid';
import { MarketplaceSearch } from '@/components/marketplace/MarketplaceSearch';
import {
  useMarketplace,
  type MarketplaceCategory,
  type MarketplaceSortBy,
} from '@/hooks/useMarketplace';

export default function MarketplacePage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MarketplaceCategory>('ALL');
  const [sortBy, setSortBy] = useState<MarketplaceSortBy>('popular');

  const { listings, isLoading, install } = useMarketplace({
    query,
    category,
    sortBy,
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
        <p className="text-muted-foreground">
          Browse and install plugins to extend your workspace.
        </p>
      </div>

      <MarketplaceSearch
        query={query}
        category={category}
        sortBy={sortBy}
        onQueryChange={setQuery}
        onCategoryChange={setCategory}
        onSortChange={setSortBy}
      />

      <MarketplaceGrid
        listings={listings}
        isLoading={isLoading}
        onInstall={install}
      />
    </div>
  );
}
