import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigCategory } from '@prisma/client';
import { Request } from 'express';

import { SuperAdminGuard, SuperAdminOnly } from '../../common/guards/super-admin.guard';

import { CreateConfigDto } from './dto/create-config.dto';
import { RestoreBackupDto } from './dto/restore-backup.dto';
import { TestConnectionDto } from './dto/test-connection.dto';
import { PlatformConfigService } from './platform-config.service';

const VALID_CATEGORIES = Object.values(ConfigCategory);

@ApiTags('platform-config')
@Controller('admin/platform-config')
@UseGuards(SuperAdminGuard)
@SuperAdminOnly()
export class PlatformConfigController {
  constructor(private readonly platformConfigService: PlatformConfigService) {}

  private validateCategory(category: string): ConfigCategory {
    if (!VALID_CATEGORIES.includes(category as ConfigCategory)) {
      throw new BadRequestException(
        `Invalid category '${category}'. Valid categories: ${VALID_CATEGORIES.join(', ')}`,
      );
    }
    return category as ConfigCategory;
  }

  // Literal routes MUST be declared before parameterized routes to avoid
  // NestJS matching literal path segments (e.g. "backup") as :category.

  @Get('backup')
  @ApiOperation({ summary: 'Export all platform configs (encrypted backup)' })
  @ApiResponse({ status: 200, description: 'Encrypted backup of all configs' })
  async backup(@Req() req: Request) {
    const user = req['user'] as { sub: string };
    return this.platformConfigService.backup(user.sub);
  }

  @Post('test-connection')
  @ApiOperation({ summary: 'Test a connection/credential before saving' })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  async testConnection(@Body() dto: TestConnectionDto) {
    return this.platformConfigService.testConnection(
      dto.category as unknown as ConfigCategory,
      dto.key,
      dto.value,
    );
  }

  @Post('rotate-key')
  @ApiOperation({ summary: 'Rotate encryption key for all secrets' })
  @ApiResponse({ status: 200, description: 'Key rotation result' })
  async rotateKey(
    // Security note: This endpoint transmits encryption keys in the request body.
    // This is acceptable because the endpoint is restricted to Super Admin only and
    // should be called over TLS. In a higher-security deployment, consider reading
    // the new key from an environment variable and only triggering rotation via this endpoint.
    @Body() body: { oldKey: string; newKey: string },
    @Req() req: Request,
  ) {
    const user = req['user'] as { sub: string };
    return this.platformConfigService.rotateKey(body.oldKey, body.newKey, user.sub);
  }

  @Post('restore')
  @ApiOperation({ summary: 'Restore platform configs from backup' })
  @ApiResponse({ status: 200, description: 'Restore result' })
  async restore(@Body() backup: RestoreBackupDto, @Req() req: Request) {
    const user = req['user'] as { sub: string };
    return this.platformConfigService.restore(
      backup as unknown as Parameters<PlatformConfigService['restore']>[0],
      user.sub,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create or update a platform config' })
  @ApiResponse({ status: 201, description: 'Config created/updated' })
  async upsert(@Body() dto: CreateConfigDto, @Req() req: Request) {
    const user = req['user'] as { sub: string };
    return this.platformConfigService.upsert(dto, user.sub);
  }

  @Delete(':category/:key')
  @ApiOperation({ summary: 'Delete a platform config' })
  @ApiResponse({ status: 200, description: 'Config deleted' })
  async delete(
    @Param('category') category: string,
    @Param('key') key: string,
    @Req() req: Request,
  ) {
    const validCategory = this.validateCategory(category);
    const user = req['user'] as { sub: string };
    return this.platformConfigService.delete(validCategory, key, user.sub);
  }

  @Get(':category/:key')
  @ApiOperation({ summary: 'Get a single config by category and key' })
  @ApiResponse({ status: 200, description: 'Single config entry' })
  async getOne(@Param('category') category: string, @Param('key') key: string) {
    const validCategory = this.validateCategory(category);
    return this.platformConfigService.getOne(validCategory, key);
  }

  @Get(':category')
  @ApiOperation({ summary: 'Get all configs by category' })
  @ApiResponse({ status: 200, description: 'List of configs for the category' })
  async getByCategory(@Param('category') category: string) {
    const validCategory = this.validateCategory(category);
    return this.platformConfigService.getAllByCategory(validCategory);
  }
}
