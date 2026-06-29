import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';

import { MarketplaceCategoryDto } from './dto/publish-listing.dto';
import { MarketplaceService } from './marketplace.service';

describe('MarketplaceService', () => {
  let service: MarketplaceService;

  const mockPrismaService = {
    marketplaceListing: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    marketplaceReview: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    plugin: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MarketplaceService>(MarketplaceService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('should return marketplace listings', async () => {
      const items = [
        { id: 'listing-1', title: 'Plugin A' },
        { id: 'listing-2', title: 'Plugin B' },
      ];

      mockPrismaService.marketplaceListing.findMany.mockResolvedValue(items);
      mockPrismaService.marketplaceListing.count.mockResolvedValue(2);

      const result = await service.search();

      expect(result).toEqual({ items, total: 2 });
    });

    it('should filter by query', async () => {
      mockPrismaService.marketplaceListing.findMany.mockResolvedValue([]);
      mockPrismaService.marketplaceListing.count.mockResolvedValue(0);

      await service.search('security');

      expect(mockPrismaService.marketplaceListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { title: { contains: 'security', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should filter by category', async () => {
      mockPrismaService.marketplaceListing.findMany.mockResolvedValue([]);
      mockPrismaService.marketplaceListing.count.mockResolvedValue(0);

      await service.search(undefined, 'SECURITY');

      expect(mockPrismaService.marketplaceListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'SECURITY' }),
        }),
      );
    });

    it('should sort by popularity', async () => {
      mockPrismaService.marketplaceListing.findMany.mockResolvedValue([]);
      mockPrismaService.marketplaceListing.count.mockResolvedValue(0);

      await service.search(undefined, undefined, 'popular');

      expect(mockPrismaService.marketplaceListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { downloads: 'desc' },
        }),
      );
    });

    it('should sort by rating', async () => {
      mockPrismaService.marketplaceListing.findMany.mockResolvedValue([]);
      mockPrismaService.marketplaceListing.count.mockResolvedValue(0);

      await service.search(undefined, undefined, 'rating');

      expect(mockPrismaService.marketplaceListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { rating: 'desc' },
        }),
      );
    });

    it('should respect limit and offset', async () => {
      mockPrismaService.marketplaceListing.findMany.mockResolvedValue([]);
      mockPrismaService.marketplaceListing.count.mockResolvedValue(0);

      await service.search(undefined, undefined, undefined, 10, 5);

      expect(mockPrismaService.marketplaceListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 5,
        }),
      );
    });
  });

  describe('getById', () => {
    it('should return a listing by id', async () => {
      const listing = {
        id: 'listing-1',
        title: 'Test Plugin',
        plugin: { name: 'Test' },
        reviews: [],
      };

      mockPrismaService.marketplaceListing.findUnique.mockResolvedValue(listing);

      const result = await service.getById('listing-1');

      expect(result).toEqual(listing);
    });

    it('should throw NotFoundException when listing does not exist', async () => {
      mockPrismaService.marketplaceListing.findUnique.mockResolvedValue(null);

      await expect(service.getById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('publish', () => {
    const dto = {
      pluginId: 'plugin-1',
      title: 'Test Plugin',
      description: 'A test plugin',
      shortDescription: 'A test plugin',
      category: MarketplaceCategoryDto.OTHER,
      tags: ['test'],
      authorId: 'user-1',
    };

    it('should publish a plugin to the marketplace', async () => {
      const plugin = { id: 'plugin-1', name: 'Test Plugin' };
      const listing = { id: 'listing-1', ...dto, plugin };

      mockPrismaService.plugin.findUnique.mockResolvedValue(plugin);
      mockPrismaService.marketplaceListing.findUnique.mockResolvedValue(null);
      mockPrismaService.marketplaceListing.create.mockResolvedValue(listing);

      const result = await service.publish(dto);

      expect(result.title).toBe('Test Plugin');
      expect(mockPrismaService.marketplaceListing.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when plugin does not exist', async () => {
      mockPrismaService.plugin.findUnique.mockResolvedValue(null);

      await expect(service.publish(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when listing already exists', async () => {
      const plugin = { id: 'plugin-1', name: 'Test Plugin' };
      const existing = { id: 'listing-1', pluginId: 'plugin-1' };

      mockPrismaService.plugin.findUnique.mockResolvedValue(plugin);
      mockPrismaService.marketplaceListing.findUnique.mockResolvedValue(existing);

      await expect(service.publish(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitReview', () => {
    const dto = {
      userId: 'user-1',
      rating: 5,
      title: 'Great plugin',
      content: 'Works well!',
    };

    it('should submit a review', async () => {
      const listing = { id: 'listing-1', title: 'Test' };
      const review = { id: 'review-1', ...dto, listingId: 'listing-1' };
      const reviews = [review];

      mockPrismaService.marketplaceListing.findUnique.mockResolvedValue(listing);
      mockPrismaService.marketplaceReview.create.mockResolvedValue(review);
      mockPrismaService.marketplaceReview.findMany.mockResolvedValue(reviews);
      mockPrismaService.marketplaceListing.update.mockResolvedValue({});

      const result = await service.submitReview('listing-1', dto);

      expect(result).toEqual(review);
    });

    it('should throw NotFoundException when listing does not exist', async () => {
      mockPrismaService.marketplaceListing.findUnique.mockResolvedValue(null);

      await expect(service.submitReview('non-existent', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update average rating after review submission', async () => {
      const listing = { id: 'listing-1', title: 'Test' };
      const existingReviews = [
        { id: 'review-1', rating: 4 },
        { id: 'review-2', rating: 5 },
      ];

      mockPrismaService.marketplaceListing.findUnique.mockResolvedValue(listing);
      mockPrismaService.marketplaceReview.create.mockResolvedValue({
        id: 'review-2',
        rating: 5,
      });
      mockPrismaService.marketplaceReview.findMany.mockResolvedValue(existingReviews);
      mockPrismaService.marketplaceListing.update.mockResolvedValue({});

      await service.submitReview('listing-1', dto);

      expect(mockPrismaService.marketplaceListing.update).toHaveBeenCalledWith({
        where: { id: 'listing-1' },
        data: {
          rating: 4.5,
          reviewCount: 2,
        },
      });
    });
  });

  describe('getReviews', () => {
    it('should return reviews for a listing', async () => {
      const listing = { id: 'listing-1', title: 'Test' };
      const items = [
        { id: 'review-1', rating: 5 },
        { id: 'review-2', rating: 4 },
      ];

      mockPrismaService.marketplaceListing.findUnique.mockResolvedValue(listing);
      mockPrismaService.marketplaceReview.findMany.mockResolvedValue(items);
      mockPrismaService.marketplaceReview.count.mockResolvedValue(2);

      const result = await service.getReviews('listing-1');

      expect(result).toEqual({ items, total: 2 });
    });

    it('should throw NotFoundException when listing does not exist', async () => {
      mockPrismaService.marketplaceListing.findUnique.mockResolvedValue(null);

      await expect(service.getReviews('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getCategories', () => {
    it('should return all categories', async () => {
      const result = await service.getCategories();

      expect(result).toHaveLength(8);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('description');
    });
  });

  describe('incrementDownloads', () => {
    it('should increment downloads count', async () => {
      const listing = { id: 'listing-1', downloads: 5 };
      const updated = { id: 'listing-1', downloads: 6 };

      mockPrismaService.marketplaceListing.findUnique.mockResolvedValue(listing);
      mockPrismaService.marketplaceListing.update.mockResolvedValue(updated);

      const result = await service.incrementDownloads('listing-1');

      expect(result.downloads).toBe(6);
      expect(mockPrismaService.marketplaceListing.update).toHaveBeenCalledWith({
        where: { id: 'listing-1' },
        data: { downloads: { increment: 1 } },
      });
    });

    it('should throw NotFoundException when listing does not exist', async () => {
      mockPrismaService.marketplaceListing.findUnique.mockResolvedValue(null);

      await expect(service.incrementDownloads('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
