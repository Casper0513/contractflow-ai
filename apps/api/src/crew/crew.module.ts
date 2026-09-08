import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

import { CrewController } from './crew.controller';
import { CrewService } from './crew.service';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [CrewController],
  providers: [CrewService],
  exports: [CrewService],
})
export class CrewModule {}
