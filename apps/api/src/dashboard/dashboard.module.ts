import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
