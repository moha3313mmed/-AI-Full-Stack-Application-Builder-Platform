import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { ProjectsService } from '../projects/projects.service';

import { CreateMemoryDto } from './dto/create-memory.dto';
import { QueryMemoryDto } from './dto/query-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { MemoryIntegrationService } from './memory-integration.service';
import { MemoryService } from './memory.service';

@ApiTags('memory')
@Controller('projects/:projectId/memory')
export class MemoryController {
  constructor(
    private readonly memoryService: MemoryService,
    private readonly projectsService: ProjectsService,
    private readonly memoryIntegrationService: MemoryIntegrationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a memory entry' })
  async create(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateMemoryDto,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    return this.memoryService.create(projectId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List or search memory entries' })
  async list(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryMemoryDto,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    if (query.searchText || query.categories || query.tags) {
      return this.memoryService.search(projectId, query);
    }
    return this.memoryService.listByProject(
      projectId,
      query.limit,
      query.offset,
    );
  }

  @Get('context')
  @ApiOperation({ summary: 'Get the full formatted context string ready for AI injection' })
  async getContext(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    const memoryContext = await this.memoryIntegrationService.loadContext(projectId);
    return {
      context: memoryContext.contextString,
      entryCount: memoryContext.entryCount,
      estimatedTokens: memoryContext.estimatedTokens,
    };
  }

  @Post('summarize')
  @ApiOperation({ summary: 'Trigger manual conversation summarization' })
  async summarize(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { conversationId: string; messages?: Array<{ role: string; content: string }> },
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    const messages = body.messages || [];
    const result = await this.memoryIntegrationService.triggerSummarization(
      projectId,
      body.conversationId,
      messages,
    );
    return result;
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get memory statistics (entry count by category, total tokens)' })
  async getStats(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    return this.memoryIntegrationService.getMemoryStats(projectId);
  }

  @Delete('category/:category')
  @ApiOperation({ summary: 'Clear all entries in a specific category' })
  async clearCategory(
    @Param('projectId') projectId: string,
    @Param('category') category: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    const entries = await this.memoryService.getByCategory(projectId, category);
    let deletedCount = 0;
    for (const entry of entries) {
      await this.memoryService.remove(entry.id);
      deletedCount++;
    }
    return { deletedCount, category };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a memory entry by id' })
  async findById(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    return this.memoryService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a memory entry' })
  async update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateMemoryDto,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    return this.memoryService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a memory entry' })
  async remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    return this.memoryService.remove(id);
  }
}
