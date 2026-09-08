import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

import { NotificationsController } from './notifications.controller';
import { NotificationsScheduler } from './notifications.scheduler';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [NotificationsController],

  providers: [NotificationsService, NotificationsScheduler],

  exports: [NotificationsService],
})
export class NotificationsModule {}
