import { Module } from '@nestjs/common';

import { FilesModule } from '../files/files.module';

import { DeployController } from './deploy.controller';
import { DeployService } from './deploy.service';

@Module({
  imports: [FilesModule],
  controllers: [DeployController],
  providers: [DeployService],
  exports: [DeployService],
})
export class DeployModule {}
