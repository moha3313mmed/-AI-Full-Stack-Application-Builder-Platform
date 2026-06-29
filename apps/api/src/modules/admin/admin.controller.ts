import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';

import { AdminGuard, AdminOnly } from '../../common/guards/admin.guard';

import { AdminService } from './admin.service';
import type { PlatformStats, PaginatedUsers } from './admin.types';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(AdminGuard)
@AdminOnly()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform statistics' })
  @ApiResponse({ status: 200, description: 'Platform statistics' })
  async getStats(): Promise<PlatformStats> {
    return this.adminService.getStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get paginated user list' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ): Promise<PaginatedUsers> {
    return this.adminService.getUsers(
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
      search,
    );
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user role' })
  @ApiResponse({ status: 200, description: 'User updated' })
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(id, dto.role);
  }

  @Get('health')
  @ApiOperation({ summary: 'Get detailed system health' })
  @ApiResponse({ status: 200, description: 'System health details' })
  async getHealth() {
    return this.adminService.getDetailedHealth();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  @ApiResponse({ status: 200, description: 'Prometheus text format metrics' })
  async getMetrics(): Promise<string> {
    return this.adminService.getMetrics();
  }
}
