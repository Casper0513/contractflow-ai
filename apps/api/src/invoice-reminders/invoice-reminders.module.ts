import { Module } from '@nestjs/common';

import { ActivityModule } from '../activity/activity.module';
import { EmailModule } from '../email/email.module';
import { InvoiceRemindersController } from './invoice-reminders.controller';
import { InvoiceRemindersScheduler } from './invoice-reminders.scheduler';
import { InvoiceRemindersService } from './invoice-reminders.service';

@Module({
  imports: [ActivityModule, EmailModule],
  controllers: [InvoiceRemindersController],
  providers: [InvoiceRemindersService, InvoiceRemindersScheduler],
  exports: [InvoiceRemindersService],
})
export class InvoiceRemindersModule {}
