import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
