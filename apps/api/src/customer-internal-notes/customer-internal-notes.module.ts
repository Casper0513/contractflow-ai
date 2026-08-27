import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { CustomerInternalNotesController } from './customer-internal-notes.controller';
import { CustomerInternalNotesService } from './customer-internal-notes.service';
import { FollowUpsController } from './follow-ups.controller';

@Module({
  imports: [NotificationsModule],

  controllers: [CustomerInternalNotesController, FollowUpsController],

  providers: [CustomerInternalNotesService],

  exports: [CustomerInternalNotesService],
})
export class CustomerInternalNotesModule {}
