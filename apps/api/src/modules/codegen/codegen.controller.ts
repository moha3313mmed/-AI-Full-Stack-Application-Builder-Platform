import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { ProjectsService } from '../projects/projects.service';

import { CodegenService } from './codegen.service';
import { GenerateCodeDto } from './dto/generate-code.dto';
import { ModifyCodeDto } from './dto/modify-code.dto';

// TODO: Add rate limiting via @nestjs/throttler to prevent LLM quota exhaustion.
// Each endpoint triggers an AI completion call; without throttling a single user
// can exhaust provider token budgets or run up costs in a loop.
@ApiTags('codegen')
@Controller('projects/:projectId/codegen')
export class CodegenController {
  constructor(
    private readonly codegenService: CodegenService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate new code using AI' })
  @ApiResponse({ status: 201, description: 'Code generated' })
  async generateCode(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: GenerateCodeDto,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    return this.codegenService.generateCode(projectId, dto);
  }

  @Post('modify')
  @ApiOperation({ summary: 'Modify existing code using AI' })
  @ApiResponse({ status: 201, description: 'Code modified' })
  async modifyCode(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ModifyCodeDto,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    return this.codegenService.modifyCode(projectId, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get code generation history for a project' })
  @ApiResponse({ status: 200, description: 'Code generation history' })
  async getHistory(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    return this.codegenService.getHistory(projectId);
  }
}
