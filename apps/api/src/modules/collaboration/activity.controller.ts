import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { ActivityService } from './activity.service';

@ApiTags('activity')
@Controller()
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('projects/:projectId/activity')
  @ApiOperation({ summary: 'Get activity for a project' })
  async findByProject(
    @Param('projectId') projectId: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.activityService.findByProject(projectId, {
      type,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }
}
