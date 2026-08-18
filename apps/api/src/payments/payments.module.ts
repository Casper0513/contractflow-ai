import { Module } from '@nestjs/common';

import { ActivityModule } from '../activity/activity.module';
import { StripePaymentService } from './stripe-payment.service';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  imports: [ActivityModule],
  controllers: [StripeWebhookController],
  providers: [StripePaymentService],
  exports: [StripePaymentService],
})
export class PaymentsModule {}
