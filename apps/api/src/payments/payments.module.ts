import { Module } from '@nestjs/common';

import { EmailModule } from '../email/email.module';
import { PaymentReceiptScheduler } from './payment-receipt.scheduler';
import { StripePaymentService } from './stripe-payment.service';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  imports: [EmailModule],

  controllers: [StripeWebhookController],

  providers: [StripePaymentService, PaymentReceiptScheduler],

  exports: [StripePaymentService],
})
export class PaymentsModule {}
