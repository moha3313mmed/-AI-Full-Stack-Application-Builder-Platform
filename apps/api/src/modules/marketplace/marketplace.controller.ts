import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { PublishListingDto } from './dto/publish-listing.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { MarketplaceService } from './marketplace.service';

@ApiTags('marketplace')
@Controller()
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('marketplace')
  @ApiOperation({ summary: 'Search and browse marketplace listings' })
  @ApiResponse({ status: 200, description: 'List of marketplace listings.' })
  async search(
    @Query('query') query?: string,
    @Query('category') category?: string,
    @Query('sort') sort?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.marketplaceService.search(
      query,
      category,
      sort,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }

  @Get('marketplace/categories')
  @ApiOperation({ summary: 'List all plugin categories' })
  @ApiResponse({ status: 200, description: 'List of categories.' })
  async getCategories() {
    return this.marketplaceService.getCategories();
  }

  @Get('marketplace/:id')
  @ApiOperation({ summary: 'Get marketplace listing details' })
  @ApiResponse({ status: 200, description: 'Listing details.' })
  async getById(@Param('id') id: string) {
    return this.marketplaceService.getById(id);
  }

  @Post('marketplace/publish')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Publish a plugin to the marketplace' })
  @ApiResponse({ status: 201, description: 'Plugin published successfully.' })
  async publish(@Body() dto: PublishListingDto) {
    return this.marketplaceService.publish(dto);
  }

  @Post('marketplace/:id/reviews')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a review for a listing' })
  @ApiResponse({ status: 201, description: 'Review submitted successfully.' })
  async submitReview(@Param('id') id: string, @Body() dto: SubmitReviewDto) {
    return this.marketplaceService.submitReview(id, dto);
  }

  @Get('marketplace/:id/reviews')
  @ApiOperation({ summary: 'Get reviews for a listing' })
  @ApiResponse({ status: 200, description: 'List of reviews.' })
  async getReviews(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.marketplaceService.getReviews(
      id,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }
}
