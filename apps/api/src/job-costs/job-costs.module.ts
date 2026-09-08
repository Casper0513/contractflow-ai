import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

import { JobCostsController } from './job-costs.controller';
import { JobCostsService } from './job-costs.service';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [JobCostsController],
  providers: [JobCostsService],
  exports: [JobCostsService],
})
export class JobCostsModule {}
