import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';

import { ConversationsService } from './conversations.service';
import { CreateConversationDto, CreateMessageDto } from './dto';

@ApiTags('conversations')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiResponse({ status: 201, description: 'Conversation created' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversationsService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all conversations' })
  @ApiResponse({ status: 200, description: 'List of conversations' })
  async findAll(@CurrentUser() user: JwtPayload) {
    return this.conversationsService.findAll(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation with messages' })
  @ApiResponse({ status: 200, description: 'Conversation details' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.conversationsService.findOne(id, user.sub);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Add a message to a conversation' })
  @ApiResponse({ status: 201, description: 'Message added' })
  async addMessage(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateMessageDto,
  ) {
    return this.conversationsService.addMessage(id, user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiResponse({ status: 200, description: 'Conversation deleted' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.conversationsService.delete(id, user.sub);
  }
}
