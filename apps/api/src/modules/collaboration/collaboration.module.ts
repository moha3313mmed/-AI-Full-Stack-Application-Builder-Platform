import { Module } from '@nestjs/common';

import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  controllers: [TeamsController, CommentsController, ActivityController],
  providers: [TeamsService, CommentsService, ActivityService],
  exports: [TeamsService, CommentsService, ActivityService],
})
export class CollaborationModule {}
