import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AiService } from './ai.service';
import { CompletionDto } from './dto/completion.dto';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('completions')
  @ApiOperation({ summary: 'Generate AI completion' })
  @ApiResponse({ status: 200, description: 'Completion generated' })
  async complete(@Body() dto: CompletionDto) {
    return this.aiService.complete(dto);
  }

  @Get('providers')
  @ApiOperation({ summary: 'List available AI providers' })
  @ApiResponse({ status: 200, description: 'List of providers' })
  getProviders() {
    return this.aiService.getAvailableProviders();
  }
}
