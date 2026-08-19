import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { EstimatesService } from './estimates.service';

@Injectable()
export class EstimateExpirationScheduler {
  private readonly logger = new Logger(EstimateExpirationScheduler.name);

  constructor(private readonly estimatesService: EstimatesService) {}

  @Cron('0 20 * * * *', {
    name: 'estimate-expiration',
    timeZone: 'UTC',
    waitForCompletion: true,
  })
  async processExpiredEstimates(): Promise<void> {
    this.logger.log('Starting scheduled estimate expiration sweep');

    try {
      const result = await this.estimatesService.processExpiredEstimates();

      this.logger.log(
        [
          'Estimate expiration sweep completed',
          `scanned=${result.scanned}`,
          `expired=${result.expired}`,
          `skipped=${result.skipped}`,
          `failures=${result.failures.length}`,
        ].join(' '),
      );

      for (const failure of result.failures) {
        this.logger.warn(
          `Estimate expiration failure estimate=${failure.estimateId}: ${failure.message}`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Scheduled estimate expiration sweep failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
