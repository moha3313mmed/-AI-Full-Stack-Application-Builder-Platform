import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { ProjectsService } from '../projects/projects.service';

import { CreateFileDto } from './dto/create-file.dto';
import { MoveFileDto } from './dto/move-file.dto';
import { ScaffoldProjectDto } from './dto/scaffold-project.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { FilesService } from './files.service';

@ApiTags('files')
@Controller('projects/:projectId/files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new file in the project' })
  @ApiResponse({ status: 201, description: 'File created' })
  async createFile(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateFileDto,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    return this.filesService.createFile(projectId, dto.path, dto.content ?? '', dto.language);
  }

  @Get('read')
  @ApiOperation({ summary: 'Read a file from the project' })
  @ApiResponse({ status: 200, description: 'File content' })
  async readFile(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
    @Query('path') path: string,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    const node = this.filesService.readFile(projectId, path);
    return {
      path: node.path,
      content: node.content?.text ?? '',
      language: node.content?.language ?? 'plaintext',
    };
  }

  @Put()
  @ApiOperation({ summary: 'Update an existing file' })
  @ApiResponse({ status: 200, description: 'File updated' })
  async updateFile(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
    @Query('path') path: string,
    @Body() dto: UpdateFileDto,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    return this.filesService.updateFile(projectId, path, dto.content, dto.language);
  }

  @Delete()
  @ApiOperation({ summary: 'Delete a file from the project' })
  @ApiResponse({ status: 200, description: 'File deleted' })
  async deleteFile(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
    @Query('path') path: string,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    this.filesService.deleteFile(projectId, path);
    return { deleted: true, path };
  }

  @Post('move')
  @ApiOperation({ summary: 'Move a file within the project' })
  @ApiResponse({ status: 200, description: 'File moved' })
  async moveFile(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: MoveFileDto,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    return this.filesService.moveFile(projectId, dto.from, dto.to);
  }

  @Get('tree')
  @ApiOperation({ summary: 'Get the project file tree' })
  @ApiResponse({ status: 200, description: 'Nested file tree' })
  async getTree(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    return this.filesService.getFileTree(projectId);
  }

  @Get('list')
  @ApiOperation({ summary: 'List directory contents' })
  @ApiResponse({ status: 200, description: 'Directory listing' })
  async listDirectory(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
    @Query('path') path: string,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    return this.filesService.listDirectory(projectId, path || '/');
  }

  @Post('scaffold')
  @ApiOperation({ summary: 'Scaffold a project with a framework template' })
  @ApiResponse({ status: 201, description: 'Project scaffolded' })
  async scaffoldProject(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ScaffoldProjectDto,
  ) {
    await this.projectsService.findOne(projectId, user.sub);
    return this.filesService.scaffoldProject(projectId, dto.framework, {
      name: dto.name,
      language: dto.language,
    });
  }
}
