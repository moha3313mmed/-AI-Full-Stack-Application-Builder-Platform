import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { ProjectsService } from '../projects/projects.service';

import { AgentExecutionsService } from './agent-executions.service';

@ApiTags('agent-executions')
@Controller('projects/:projectId/agents/executions')
export class AgentExecutionsController {
  constructor(
    private readonly agentExecutionsService: AgentExecutionsService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List agent executions for a project' })
  @ApiResponse({ status: 200, description: 'List of agent executions' })
  async listByProject(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    return this.agentExecutionsService.listByProject(projectId);
  }
}
