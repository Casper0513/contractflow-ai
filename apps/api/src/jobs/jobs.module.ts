import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
