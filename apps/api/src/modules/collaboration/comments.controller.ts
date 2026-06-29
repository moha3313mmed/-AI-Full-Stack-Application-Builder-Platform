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
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@ApiTags('comments')
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('projects/:projectId/comments')
  @ApiOperation({ summary: 'Create a comment on a project' })
  async create(
    @Param('projectId') projectId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(projectId, user.sub, dto);
  }

  @Get('projects/:projectId/comments')
  @ApiOperation({ summary: 'List comments for a project' })
  async findByProject(
    @Param('projectId') projectId: string,
    @Query('filePath') filePath?: string,
  ) {
    return this.commentsService.findByProject(projectId, filePath);
  }

  @Patch('projects/:projectId/comments/:id')
  @ApiOperation({ summary: 'Update a comment' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(id, dto);
  }

  @Delete('projects/:projectId/comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a comment' })
  async delete(@Param('id') id: string) {
    await this.commentsService.delete(id);
  }

  @Post('comments/:id/resolve')
  @ApiOperation({ summary: 'Resolve a comment thread' })
  async resolve(@Param('id') id: string) {
    return this.commentsService.resolve(id);
  }
}
