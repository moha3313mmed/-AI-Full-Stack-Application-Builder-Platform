import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';

import { ProcessMessageDto } from './dto';
import { WorkflowService } from './workflow.service';

@ApiTags('workflow')
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post('message')
  @ApiOperation({ summary: 'Process a user message through the full workflow pipeline' })
  @ApiResponse({ status: 201, description: 'Workflow triggered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async processMessage(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ProcessMessageDto,
  ) {
    return this.workflowService.processMessage(user.sub, dto);
  }
}
