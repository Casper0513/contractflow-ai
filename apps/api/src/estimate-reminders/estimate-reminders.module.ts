import { Module } from '@nestjs/common';

import { EmailModule } from '../email/email.module';
import { EstimateRemindersScheduler } from './estimate-reminders.scheduler';
import { EstimateRemindersService } from './estimate-reminders.service';

@Module({
  imports: [EmailModule],

  providers: [EstimateRemindersService, EstimateRemindersScheduler],

  exports: [EstimateRemindersService],
})
export class EstimateRemindersModule {}
