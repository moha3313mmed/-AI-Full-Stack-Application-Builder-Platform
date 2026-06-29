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

import { DeployService } from './deploy.service';
import { CreateDeploymentDto } from './dto/create-deployment.dto';

@ApiTags('deployments')
@Controller()
export class DeployController {
  constructor(private readonly deployService: DeployService) {}

  @Post('deployments')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger a new deployment' })
  @ApiResponse({ status: 202, description: 'Deployment accepted and processing has begun.' })
  async create(@Body() dto: CreateDeploymentDto) {
    // TODO: Replace synchronous pipeline execution with queue-based async processing.
    // Currently the pipeline runs inline. In production, enqueue the job and return
    // the pending record immediately so the client can poll for status updates.
    return this.deployService.create(dto);
  }

  @Get('deployments/:id')
  @ApiOperation({ summary: 'Get deployment status' })
  async findById(@Param('id') id: string) {
    return this.deployService.findById(id);
  }

  @Get('projects/:projectId/deployments')
  @ApiOperation({ summary: 'List deployments for a project' })
  async findByProject(
    @Param('projectId') projectId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.deployService.findByProject(
      projectId,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }

  @Post('deployments/:id/rollback')
  @ApiOperation({ summary: 'Rollback a deployment' })
  async rollback(@Param('id') id: string) {
    return this.deployService.rollback(id);
  }

  @Get('deployments/:id/logs')
  @ApiOperation({ summary: 'Get deployment logs' })
  async getLogs(@Param('id') id: string) {
    return this.deployService.getLogs(id);
  }
}
