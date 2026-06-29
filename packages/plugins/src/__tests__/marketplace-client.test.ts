import { describe, it, expect, beforeEach } from 'vitest';

import { MarketplaceClient } from '../marketplace/marketplace-client.js';
import {
  MarketplaceListing,
  PluginCategory,
  PluginHook,
  PluginManifest,
  PluginPermission,
} from '../types/index.js';

describe('MarketplaceClient', () => {
  let client: MarketplaceClient;

  const createListing = (id: string, overrides?: Partial<MarketplaceListing>): MarketplaceListing => ({
    id,
    name: `Plugin ${id}`,
    version: '1.0.0',
    author: 'Test Author',
    description: `Description for ${id}`,
    keywords: ['test'],
    category: PluginCategory.TOOLING,
    downloads: 100,
    rating: 4.5,
    reviewCount: 10,
    publishedAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    verified: true,
    ...overrides,
  });

  const createManifest = (id: string): PluginManifest => ({
    id,
    name: `Plugin ${id}`,
    version: '1.0.0',
    author: 'Publisher',
    description: `Marketplace plugin ${id}`,
    keywords: ['marketplace', 'test'],
    category: PluginCategory.INTEGRATION,
    permissions: [PluginPermission.NETWORK],
    entry: './dist/index.js',
    hooks: [PluginHook.ON_INSTALL],
    dependencies: {},
    engines: { builder: '>=1.0.0' },
  });

  beforeEach(() => {
    client = new MarketplaceClient({ baseUrl: 'https://marketplace.builder.io' });
  });

  it('should search and return matching plugins by name', async () => {
    client.addListing(createListing('plugin-alpha', { name: 'Alpha Plugin' }));
    client.addListing(createListing('plugin-beta', { name: 'Beta Plugin' }));

    const result = await client.search('Alpha');
    expect(result.items.length).toBe(1);
    expect(result.items[0].id).toBe('plugin-alpha');
  });

  it('should search by keywords', async () => {
    client.addListing(createListing('plugin-1', { keywords: ['formatter', 'code'] }));
    client.addListing(createListing('plugin-2', { keywords: ['linter'] }));

    const result = await client.search('formatter');
    expect(result.items.length).toBe(1);
    expect(result.items[0].id).toBe('plugin-1');
  });

  it('should return all plugins for empty query', async () => {
    client.addListing(createListing('plugin-1'));
    client.addListing(createListing('plugin-2'));

    const result = await client.search('');
    expect(result.items.length).toBe(2);
  });

  it('should filter by category', async () => {
    client.addListing(createListing('plugin-1', { category: PluginCategory.TOOLING }));
    client.addListing(createListing('plugin-2', { category: PluginCategory.SECURITY }));

    const result = await client.search('', { category: PluginCategory.SECURITY });
    expect(result.items.length).toBe(1);
    expect(result.items[0].id).toBe('plugin-2');
  });

  it('should filter by minimum rating', async () => {
    client.addListing(createListing('plugin-1', { rating: 3.0 }));
    client.addListing(createListing('plugin-2', { rating: 4.5 }));

    const result = await client.search('', { minRating: 4.0 });
    expect(result.items.length).toBe(1);
    expect(result.items[0].id).toBe('plugin-2');
  });

  it('should filter by verified status', async () => {
    client.addListing(createListing('plugin-1', { verified: true }));
    client.addListing(createListing('plugin-2', { verified: false }));

    const result = await client.search('', { verified: true });
    expect(result.items.length).toBe(1);
    expect(result.items[0].id).toBe('plugin-1');
  });

  it('should sort by downloads', async () => {
    client.addListing(createListing('plugin-1', { downloads: 50 }));
    client.addListing(createListing('plugin-2', { downloads: 200 }));

    const result = await client.search('', { sortBy: 'downloads' });
    expect(result.items[0].id).toBe('plugin-2');
  });

  it('should paginate results', async () => {
    for (let i = 0; i < 25; i++) {
      client.addListing(createListing(`plugin-${i}`));
    }

    const page1 = await client.search('', { page: 1, pageSize: 10 });
    expect(page1.items.length).toBe(10);
    expect(page1.total).toBe(25);
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(10);

    const page3 = await client.search('', { page: 3, pageSize: 10 });
    expect(page3.items.length).toBe(5);
  });

  it('should get a plugin by ID', async () => {
    client.addListing(createListing('plugin-1'));
    const listing = await client.getById('plugin-1');
    expect(listing).not.toBeNull();
    expect(listing!.id).toBe('plugin-1');
  });

  it('should return null for non-existent plugin', async () => {
    const listing = await client.getById('non-existent');
    expect(listing).toBeNull();
  });

  it('should publish a plugin', async () => {
    const manifest = createManifest('new-plugin');
    const listing = await client.publish(manifest);
    expect(listing.id).toBe('new-plugin');
    expect(listing.name).toBe('Plugin new-plugin');
    expect(listing.downloads).toBe(0);
    expect(listing.verified).toBe(false);
  });

  it('should submit a review', async () => {
    client.addListing(createListing('plugin-1'));
    const review = await client.submitReview('plugin-1', {
      userId: 'user-1',
      rating: 5,
      title: 'Great plugin',
      body: 'Works perfectly!',
    });
    expect(review.pluginId).toBe('plugin-1');
    expect(review.rating).toBe(5);
  });

  it('should throw when submitting review for non-existent plugin', async () => {
    await expect(
      client.submitReview('unknown', {
        userId: 'user-1',
        rating: 5,
        title: 'Test',
        body: 'Test',
      }),
    ).rejects.toThrow('not found');
  });

  it('should throw for invalid rating', async () => {
    client.addListing(createListing('plugin-1'));
    await expect(
      client.submitReview('plugin-1', {
        userId: 'user-1',
        rating: 6,
        title: 'Test',
        body: 'Test',
      }),
    ).rejects.toThrow('Rating must be between 1 and 5');
  });

  it('should get versions for a published plugin', async () => {
    const manifest = createManifest('new-plugin');
    await client.publish(manifest);
    const versions = await client.getVersions('new-plugin');
    expect(versions.length).toBe(1);
    expect(versions[0].version).toBe('1.0.0');
  });

  it('should get reviews for a plugin', async () => {
    client.addListing(createListing('plugin-1'));
    await client.submitReview('plugin-1', {
      userId: 'user-1',
      rating: 4,
      title: 'Good',
      body: 'Nice plugin',
    });
    const reviews = await client.getReviews('plugin-1');
    expect(reviews.length).toBe(1);
  });
});
