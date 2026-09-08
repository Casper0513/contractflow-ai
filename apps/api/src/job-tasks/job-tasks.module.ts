import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

import { JobTasksController } from './job-tasks.controller';
import { JobTasksService } from './job-tasks.service';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [JobTasksController],
  providers: [JobTasksService],
  exports: [JobTasksService],
})
export class JobTasksModule {}
