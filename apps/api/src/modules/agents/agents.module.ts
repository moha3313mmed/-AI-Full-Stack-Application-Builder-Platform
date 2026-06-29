import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';

import { AgentExecutionsController } from './agent-executions.controller';
import { AgentExecutionsService } from './agent-executions.service';
import { AgentsController } from './agents.controller';
import { AgentsGateway } from './agents.gateway';
import { AgentsService } from './agents.service';

@Module({
  imports: [AiModule, AuthModule, ProjectsModule],
  controllers: [AgentsController, AgentExecutionsController],
  providers: [AgentsService, AgentsGateway, AgentExecutionsService],
  exports: [AgentsService],
})
export class AgentsModule {}
