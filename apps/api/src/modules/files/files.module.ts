import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';

import { FilePersistenceService } from './file-persistence.service';
import { FilesController } from './files.controller';
import { FilesGateway } from './files.gateway';
import { FilesService } from './files.service';
import { StorageService } from './storage.service';

@Module({
  imports: [AuthModule, ProjectsModule, PrismaModule],
  controllers: [FilesController],
  providers: [FilesService, FilesGateway, StorageService, FilePersistenceService],
  exports: [FilesService],
})
export class FilesModule {}
