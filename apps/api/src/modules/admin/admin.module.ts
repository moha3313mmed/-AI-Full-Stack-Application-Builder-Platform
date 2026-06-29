import { Module } from '@nestjs/common';

import { AdminGuard } from '../../common/guards/admin.guard';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
