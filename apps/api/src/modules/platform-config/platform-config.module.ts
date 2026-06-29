import { Module } from '@nestjs/common';

import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { AuditModule } from '../audit/audit.module';
import { CacheModule } from '../cache/cache.module';
import { PrismaModule } from '../prisma/prisma.module';

import { DynamicConfigService } from './dynamic-config.service';
import { EncryptionService } from './encryption.service';
import { PlatformConfigController } from './platform-config.controller';
import { PlatformConfigService } from './platform-config.service';

@Module({
  imports: [PrismaModule, CacheModule, AuditModule],
  controllers: [PlatformConfigController],
  providers: [
    EncryptionService,
    PlatformConfigService,
    DynamicConfigService,
    SuperAdminGuard,
  ],
  exports: [PlatformConfigService, DynamicConfigService],
})
export class PlatformConfigModule {}
