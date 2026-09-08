import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

import { JobTimeEntriesController } from './job-time-entries.controller';
import { JobTimeEntriesService } from './job-time-entries.service';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [JobTimeEntriesController],
  providers: [JobTimeEntriesService],
  exports: [JobTimeEntriesService],
})
export class JobTimeEntriesModule {}
