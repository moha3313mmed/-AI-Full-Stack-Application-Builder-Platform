import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { FilesModule } from '../files/files.module';
import { ProjectsModule } from '../projects/projects.module';

import { CodegenController } from './codegen.controller';
import { CodegenService } from './codegen.service';

@Module({
  imports: [AiModule, FilesModule, ProjectsModule],
  controllers: [CodegenController],
  providers: [CodegenService],
  exports: [CodegenService],
})
export class CodegenModule {}
