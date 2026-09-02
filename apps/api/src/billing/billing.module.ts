import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingController } from './billing.controller';
import { BillingStripeWebhookController } from './billing-stripe-webhook.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [AuthModule],
  controllers: [BillingController, BillingStripeWebhookController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
