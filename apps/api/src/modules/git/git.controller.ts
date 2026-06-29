import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CommitDto } from './dto/commit.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateRepositoryDto } from './dto/create-repository.dto';
import { GitService } from './git.service';

@ApiTags('git')
@Controller('git')
export class GitController {
  constructor(private readonly gitService: GitService) {}

  @Post('repositories')
  @ApiOperation({ summary: 'Create or connect a git repository' })
  async createRepository(@Body() dto: CreateRepositoryDto) {
    return this.gitService.createRepository(dto);
  }

  @Get('repositories/:projectId')
  @ApiOperation({ summary: 'Get repository info for a project' })
  async findByProject(@Param('projectId') projectId: string) {
    return this.gitService.findByProject(projectId);
  }

  @Post('repositories/:projectId/commit')
  @ApiOperation({ summary: 'Commit files to the repository' })
  async commit(
    @Param('projectId') projectId: string,
    @Body() dto: CommitDto,
  ) {
    return this.gitService.commit(projectId, dto);
  }

  @Post('repositories/:projectId/branches')
  @ApiOperation({ summary: 'Create a new branch' })
  async createBranch(
    @Param('projectId') projectId: string,
    @Body() dto: CreateBranchDto,
  ) {
    return this.gitService.createBranch(projectId, dto);
  }

  @Get('repositories/:projectId/branches')
  @ApiOperation({ summary: 'List branches for a project repository' })
  async listBranches(@Param('projectId') projectId: string) {
    return this.gitService.listBranches(projectId);
  }

  @Post('repositories/:projectId/pull-requests')
  @ApiOperation({ summary: 'Create a pull request' })
  async createPullRequest(
    @Param('projectId') projectId: string,
    @Body() body: { title: string; description: string; sourceBranch: string; targetBranch: string; reviewers?: string[] },
  ) {
    return this.gitService.createPullRequest(projectId, body);
  }

  @Get('repositories/:projectId/history')
  @ApiOperation({ summary: 'Get commit history' })
  async getHistory(
    @Param('projectId') projectId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.gitService.getHistory(
      projectId,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
  }
}
