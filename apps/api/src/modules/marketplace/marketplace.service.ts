import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { PublishListingDto } from './dto/publish-listing.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query?: string, category?: string, sort?: string, limit = 20, offset = 0) {
    const where: Prisma.MarketplaceListingWhereInput = {};

    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category as Prisma.EnumPluginCategoryFilter['equals'];
    }

    let orderBy: Prisma.MarketplaceListingOrderByWithRelationInput = { publishedAt: 'desc' };

    if (sort === 'popular') {
      orderBy = { downloads: 'desc' };
    } else if (sort === 'rating') {
      orderBy = { rating: 'desc' };
    }

    const [items, total] = await Promise.all([
      this.prisma.marketplaceListing.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy,
        include: { plugin: true },
      }),
      this.prisma.marketplaceListing.count({ where }),
    ]);

    return { items, total };
  }

  async getById(id: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id },
      include: { plugin: true, reviews: true },
    });

    if (!listing) {
      throw new NotFoundException(`Marketplace listing with id "${id}" not found`);
    }

    return listing;
  }

  async publish(dto: PublishListingDto) {
    // Verify plugin exists
    const plugin = await this.prisma.plugin.findUnique({
      where: { id: dto.pluginId },
    });

    if (!plugin) {
      throw new NotFoundException(`Plugin with id "${dto.pluginId}" not found`);
    }

    // Check if listing already exists for this plugin
    const existing = await this.prisma.marketplaceListing.findUnique({
      where: { pluginId: dto.pluginId },
    });

    if (existing) {
      throw new BadRequestException(
        `A marketplace listing already exists for plugin "${dto.pluginId}"`,
      );
    }

    return this.prisma.marketplaceListing.create({
      data: {
        pluginId: dto.pluginId,
        title: dto.title,
        description: dto.description,
        shortDescription: dto.shortDescription,
        category: dto.category,
        tags: dto.tags || [],
        icon: dto.icon,
        screenshots: dto.screenshots || [],
        authorId: dto.authorId,
      },
      include: { plugin: true },
    });
  }

  async submitReview(listingId: string, dto: SubmitReviewDto) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException(`Marketplace listing with id "${listingId}" not found`);
    }

    const review = await this.prisma.marketplaceReview.create({
      data: {
        listingId,
        userId: dto.userId,
        rating: dto.rating,
        title: dto.title,
        content: dto.content,
      },
    });

    // Update listing rating
    const reviews = await this.prisma.marketplaceReview.findMany({
      where: { listingId },
    });

    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: {
        rating: Math.round(avgRating * 10) / 10,
        reviewCount: reviews.length,
      },
    });

    return review;
  }

  async getReviews(listingId: string, limit = 20, offset = 0) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException(`Marketplace listing with id "${listingId}" not found`);
    }

    const [items, total] = await Promise.all([
      this.prisma.marketplaceReview.findMany({
        where: { listingId },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.marketplaceReview.count({ where: { listingId } }),
    ]);

    return { items, total };
  }

  async getCategories() {
    return [
      { id: 'TOOLING', name: 'Tooling', description: 'Developer tools and utilities' },
      { id: 'INTEGRATION', name: 'Integration', description: 'Third-party service integrations' },
      { id: 'THEME', name: 'Theme', description: 'UI themes and customization' },
      { id: 'LANGUAGE', name: 'Language', description: 'Language support and syntax tools' },
      { id: 'DEPLOYMENT', name: 'Deployment', description: 'Deployment and CI/CD tools' },
      { id: 'SECURITY', name: 'Security', description: 'Security scanning and protection' },
      { id: 'AI', name: 'AI', description: 'AI-powered agent plugins' },
      { id: 'OTHER', name: 'Other', description: 'General plugins' },
    ];
  }

  async incrementDownloads(listingId: string) {
    const listing = await this.prisma.marketplaceListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new NotFoundException(`Marketplace listing with id "${listingId}" not found`);
    }

    return this.prisma.marketplaceListing.update({
      where: { id: listingId },
      data: {
        downloads: { increment: 1 },
      },
    });
  }
}
