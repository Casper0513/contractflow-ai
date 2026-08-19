import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { StripePaymentService } from './stripe-payment.service';

@Injectable()
export class PaymentReceiptScheduler {
  private readonly logger = new Logger(PaymentReceiptScheduler.name);

  constructor(private readonly stripePaymentService: StripePaymentService) {}

  @Cron('0 */15 * * * *', {
    name: 'payment-receipt-retries',
    timeZone: 'UTC',
    waitForCompletion: true,
  })
  async retryPaymentReceipts(): Promise<void> {
    this.logger.log('Starting payment receipt retry sweep');

    try {
      const result =
        await this.stripePaymentService.processPendingReceiptDeliveries();

      this.logger.log(
        [
          'Payment receipt retry sweep completed',
          `scanned=${result.scanned}`,
          `sent=${result.sent}`,
          `failed=${result.failed}`,
          `skipped=${result.skipped}`,
        ].join(' '),
      );
    } catch (error) {
      this.logger.error(
        'Payment receipt retry sweep failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
