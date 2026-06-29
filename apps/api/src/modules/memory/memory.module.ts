import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { ProjectsModule } from '../projects/projects.module';

import { ConversationSummarizer } from './conversation-summarizer';
import { MemoryExtractor } from './memory-extractor';
import { MemoryIntegrationService } from './memory-integration.service';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';

@Module({
  imports: [ProjectsModule, AiModule],
  controllers: [MemoryController],
  providers: [MemoryService, MemoryExtractor, ConversationSummarizer, MemoryIntegrationService],
  exports: [MemoryService, MemoryExtractor, ConversationSummarizer, MemoryIntegrationService],
})
export class MemoryModule {}
