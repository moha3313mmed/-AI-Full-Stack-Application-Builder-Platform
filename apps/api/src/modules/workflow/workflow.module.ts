import { Module } from '@nestjs/common';

import { AgentsModule } from '../agents/agents.module';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { CodegenModule } from '../codegen/codegen.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { DeployModule } from '../deploy/deploy.module';
import { FilesModule } from '../files/files.module';
import { GitModule } from '../git/git.module';
import { MemoryModule } from '../memory/memory.module';
import { ProjectsModule } from '../projects/projects.module';

import { ParallelExecutionService } from './parallel-execution.service';
import { RecoveryController } from './recovery.controller';
import { RecoveryService } from './recovery.service';
import { ValidationPipeline } from './validation-pipeline';
import { WorkflowController } from './workflow.controller';
import { WorkflowGateway } from './workflow.gateway';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [
    AuthModule,
    ConversationsModule,
    AgentsModule,
    AiModule,
    CodegenModule,
    FilesModule,
    GitModule,
    DeployModule,
    ProjectsModule,
    MemoryModule,
  ],
  controllers: [WorkflowController, RecoveryController],
  providers: [
    WorkflowService,
    WorkflowGateway,
    ParallelExecutionService,
    RecoveryService,
    ValidationPipeline,
  ],
  exports: [WorkflowService, RecoveryService],
})
export class WorkflowModule {}
