import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AppConfigModule } from './config/config.module';
import { AdminModule } from './modules/admin/admin.module';
import { AgentsModule } from './modules/agents/agents.module';
import { AiModule } from './modules/ai/ai.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CacheModule } from './modules/cache/cache.module';
import { CodegenModule } from './modules/codegen/codegen.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { DeployModule } from './modules/deploy/deploy.module';
import { FilesModule } from './modules/files/files.module';
import { GitModule } from './modules/git/git.module';
import { HealthModule } from './modules/health/health.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { MemoryModule } from './modules/memory/memory.module';
import { PluginsModule } from './modules/plugins/plugins.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RateLimitModule } from './modules/rate-limit/rate-limit.module';
import { SecurityModule } from './modules/security/security.module';
import { UsersModule } from './modules/users/users.module';
import { PlatformConfigModule } from './modules/platform-config/platform-config.module';
import { WorkflowModule } from './modules/workflow/workflow.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    AiModule,
    AgentsModule,
    ConversationsModule,
    FilesModule,
    CodegenModule,
    HealthModule,
    MemoryModule,
    DeployModule,
    GitModule,
    CollaborationModule,
    PluginsModule,
    MarketplaceModule,
    SecurityModule,
    RateLimitModule,
    ApiKeysModule,
    AuditModule,
    CacheModule,
    JobsModule,
    AdminModule,
    WorkflowModule,
    PlatformConfigModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
