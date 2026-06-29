'use client';

import useSWR from 'swr';

import { apiClient } from '@/lib/api';

export type MarketplaceCategory =
  | 'ALL'
  | 'TOOLING'
  | 'INTEGRATION'
  | 'THEME'
  | 'LANGUAGE'
  | 'DEPLOYMENT'
  | 'SECURITY'
  | 'AI'
  | 'OTHER';

export type MarketplaceSortBy = 'popular' | 'recent' | 'top_rated';

export interface MarketplaceListing {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  author: string;
  category: MarketplaceCategory;
  tags: string[];
  icon?: string;
  screenshots: string[];
  downloads: number;
  rating: number;
  reviewCount: number;
  version: string;
  publishedAt: string;
  updatedAt: string;
}

export interface MarketplaceFilters {
  query?: string;
  category?: MarketplaceCategory;
  sortBy?: MarketplaceSortBy;
}

const buildSearchUrl = (filters: MarketplaceFilters): string => {
  const params = new URLSearchParams();
  if (filters.query) params.set('query', filters.query);
  if (filters.category && filters.category !== 'ALL') params.set('category', filters.category);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  const paramStr = params.toString();
  return `/marketplace${paramStr ? `?${paramStr}` : ''}`;
};

const fetcher = async (url: string): Promise<MarketplaceListing[]> => {
  return apiClient.get<MarketplaceListing[]>(url);
};

export function useMarketplace(filters: MarketplaceFilters = {}) {
  const url = buildSearchUrl(filters);

  const { data, error, isLoading, mutate } = useSWR(
    url,
    fetcher
  );

  const search = async (_query: string) => {
    await mutate();
    return data;
  };

  const install = async (listingId: string) => {
    const result = await apiClient.post<{ success: boolean }>(
      `/marketplace/${listingId}/install`
    );
    await mutate();
    return result;
  };

  return {
    listings: data ?? [],
    isLoading,
    isError: !!error,
    error,
    search,
    install,
  };
}
