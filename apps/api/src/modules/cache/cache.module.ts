import { Module } from '@nestjs/common';

import { AppCacheService } from './cache.service';

@Module({
  providers: [AppCacheService],
  exports: [AppCacheService],
})
export class CacheModule {}
