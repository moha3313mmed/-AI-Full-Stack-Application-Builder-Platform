'use client';

import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import type { MarketplaceCategory, MarketplaceSortBy } from '@/hooks/useMarketplace';

interface MarketplaceSearchProps {
  query: string;
  category: MarketplaceCategory;
  sortBy: MarketplaceSortBy;
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: MarketplaceCategory) => void;
  onSortChange: (sortBy: MarketplaceSortBy) => void;
}

const categories: { value: MarketplaceCategory; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'AI', label: 'AI' },
  { value: 'INTEGRATION', label: 'Integration' },
  { value: 'THEME', label: 'Theme' },
  { value: 'TOOLING', label: 'Tooling' },
  { value: 'LANGUAGE', label: 'Language' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'DEPLOYMENT', label: 'Deployment' },
  { value: 'OTHER', label: 'Other' },
];

const sortOptions: { value: MarketplaceSortBy; label: string }[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'recent', label: 'Recent' },
  { value: 'top_rated', label: 'Top Rated' },
];

export function MarketplaceSearch({
  query,
  category,
  sortBy,
  onQueryChange,
  onCategoryChange,
  onSortChange,
}: MarketplaceSearchProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search plugins..."
          className="pl-9"
        />
      </div>
      <select
        value={category}
        onChange={(e) => onCategoryChange(e.target.value as MarketplaceCategory)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        {categories.map((cat) => (
          <option key={cat.value} value={cat.value}>
            {cat.label}
          </option>
        ))}
      </select>
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as MarketplaceSortBy)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        {sortOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
