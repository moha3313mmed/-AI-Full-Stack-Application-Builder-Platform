import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { InstallPluginDto } from './dto/install-plugin.dto';
import { UpdatePluginConfigDto } from './dto/update-plugin-config.dto';
import { PluginsService } from './plugins.service';

@ApiTags('plugins')
@Controller()
export class PluginsController {
  constructor(private readonly pluginsService: PluginsService) {}

  @Post('plugins/install')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Install a plugin for a project' })
  @ApiResponse({ status: 201, description: 'Plugin installed successfully.' })
  async install(@Body() dto: InstallPluginDto) {
    return this.pluginsService.install(dto);
  }

  @Post('plugins/:id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate an installed plugin' })
  @ApiResponse({ status: 200, description: 'Plugin activated successfully.' })
  async activate(@Param('id') id: string) {
    return this.pluginsService.activate(id);
  }

  @Post('plugins/:id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a plugin' })
  @ApiResponse({ status: 200, description: 'Plugin deactivated successfully.' })
  async deactivate(@Param('id') id: string) {
    return this.pluginsService.deactivate(id);
  }

  @Delete('plugins/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Uninstall a plugin' })
  @ApiResponse({ status: 200, description: 'Plugin uninstalled successfully.' })
  async uninstall(@Param('id') id: string) {
    return this.pluginsService.uninstall(id);
  }

  @Get('plugins')
  @ApiOperation({ summary: 'List installed plugins' })
  @ApiResponse({ status: 200, description: 'List of installed plugins.' })
  async findAll(
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ) {
    return this.pluginsService.findAll(projectId, status);
  }

  @Get('plugins/:id')
  @ApiOperation({ summary: 'Get plugin details' })
  @ApiResponse({ status: 200, description: 'Plugin details.' })
  async findById(@Param('id') id: string) {
    return this.pluginsService.findById(id);
  }

  @Patch('plugins/:id/config')
  @ApiOperation({ summary: 'Update plugin configuration' })
  @ApiResponse({ status: 200, description: 'Plugin configuration updated.' })
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdatePluginConfigDto,
  ) {
    return this.pluginsService.updateConfig(id, dto);
  }
}
