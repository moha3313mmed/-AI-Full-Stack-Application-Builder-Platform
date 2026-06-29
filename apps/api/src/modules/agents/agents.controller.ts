import { Body, Controller, Get, Param, Post, Request } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AgentsService } from './agents.service';
import { TriggerAgentDto } from './dto/trigger-agent.dto';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('workflows')
  @ApiOperation({ summary: 'Trigger an agent workflow' })
  @ApiResponse({ status: 201, description: 'Workflow started' })
  async triggerWorkflow(
    @Body() dto: TriggerAgentDto,
    @Request() req: { user: { sub: string } },
  ) {
    return this.agentsService.triggerWorkflow(dto, req.user.sub);
  }

  @Get('workflows/:id')
  @ApiOperation({ summary: 'Get workflow status' })
  @ApiResponse({ status: 200, description: 'Workflow status' })
  async getWorkflowStatus(@Param('id') id: string) {
    return this.agentsService.getWorkflowStatus(id);
  }
}
