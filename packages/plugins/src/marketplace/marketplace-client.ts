import {
  MarketplaceListing,
  MarketplaceSearchFilters,
  MarketplaceSearchResult,
  PluginManifest,
  PluginReview,
  PluginVersion,
} from '../types/index.js';

export interface MarketplaceClientOptions {
  baseUrl: string;
  apiKey?: string;
}

/**
 * MarketplaceClient for searching, browsing, and fetching plugin listings.
 * Provides methods for plugin discovery, publishing, and reviews.
 */
export class MarketplaceClient {
  private baseUrl: string;
  private apiKey?: string;
  private listings: Map<string, MarketplaceListing> = new Map();
  private versions: Map<string, PluginVersion[]> = new Map();
  private reviews: Map<string, PluginReview[]> = new Map();

  constructor(options: MarketplaceClientOptions) {
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey; // stored for future API calls
  }

  /**
   * Search for plugins in the marketplace.
   */
  async search(query: string, filters?: MarketplaceSearchFilters): Promise<MarketplaceSearchResult> {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;

    let results = Array.from(this.listings.values());

    // Filter by query
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(
        (listing) =>
          listing.name.toLowerCase().includes(lowerQuery) ||
          listing.description.toLowerCase().includes(lowerQuery) ||
          listing.keywords.some((k) => k.toLowerCase().includes(lowerQuery)),
      );
    }

    // Apply filters
    if (filters?.category) {
      results = results.filter((listing) => listing.category === filters.category);
    }
    if (filters?.minRating !== undefined) {
      results = results.filter((listing) => listing.rating >= filters.minRating!);
    }
    if (filters?.verified !== undefined) {
      results = results.filter((listing) => listing.verified === filters.verified);
    }

    // Sort
    if (filters?.sortBy === 'downloads') {
      results.sort((a, b) => b.downloads - a.downloads);
    } else if (filters?.sortBy === 'rating') {
      results.sort((a, b) => b.rating - a.rating);
    } else if (filters?.sortBy === 'recent') {
      results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }

    // Paginate
    const total = results.length;
    const start = (page - 1) * pageSize;
    const items = results.slice(start, start + pageSize);

    return { items, total, page, pageSize };
  }

  /**
   * Get a plugin listing by ID.
   */
  async getById(id: string): Promise<MarketplaceListing | null> {
    return this.listings.get(id) ?? null;
  }

  /**
   * Get all versions for a plugin.
   */
  async getVersions(pluginId: string): Promise<PluginVersion[]> {
    return this.versions.get(pluginId) ?? [];
  }

  /**
   * Get reviews for a plugin.
   */
  async getReviews(pluginId: string): Promise<PluginReview[]> {
    return this.reviews.get(pluginId) ?? [];
  }

  /**
   * Submit a review for a plugin.
   */
  async submitReview(pluginId: string, review: Omit<PluginReview, 'id' | 'pluginId' | 'createdAt'>): Promise<PluginReview> {
    if (!this.listings.has(pluginId)) {
      throw new Error(`Plugin "${pluginId}" not found in marketplace`);
    }

    if (review.rating < 1 || review.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const newReview: PluginReview = {
      id: `review-${Date.now()}`,
      pluginId,
      ...review,
      createdAt: new Date(),
    };

    const existing = this.reviews.get(pluginId) ?? [];
    existing.push(newReview);
    this.reviews.set(pluginId, existing);

    // Update listing review count and rating
    const listing = this.listings.get(pluginId)!;
    listing.reviewCount = existing.length;
    listing.rating =
      existing.reduce((sum, r) => sum + r.rating, 0) / existing.length;

    return newReview;
  }

  /**
   * Publish a plugin to the marketplace.
   */
  async publish(manifest: PluginManifest, _bundle?: Buffer): Promise<MarketplaceListing> {
    const now = new Date();

    const listing: MarketplaceListing = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      author: manifest.author,
      description: manifest.description,
      keywords: manifest.keywords,
      category: manifest.category,
      downloads: 0,
      rating: 0,
      reviewCount: 0,
      publishedAt: now,
      updatedAt: now,
      verified: false,
    };

    this.listings.set(manifest.id, listing);

    // Add version entry
    const version: PluginVersion = {
      version: manifest.version,
      changelog: `Initial release of ${manifest.name}`,
      publishedAt: now,
      minBuilderVersion: manifest.engines.builder,
      downloads: 0,
    };

    const versions = this.versions.get(manifest.id) ?? [];
    versions.push(version);
    this.versions.set(manifest.id, versions);

    return listing;
  }

  /**
   * Add a listing directly (for testing/seeding).
   */
  addListing(listing: MarketplaceListing): void {
    this.listings.set(listing.id, listing);
  }

  /**
   * Get the base URL of the marketplace.
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Get the configured API key.
   */
  getApiKey(): string | undefined {
    return this.apiKey;
  }
}
