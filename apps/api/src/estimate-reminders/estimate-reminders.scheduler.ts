import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { EstimateRemindersService } from './estimate-reminders.service';

@Injectable()
export class EstimateRemindersScheduler {
  private readonly logger = new Logger(EstimateRemindersScheduler.name);

  constructor(
    private readonly estimateRemindersService: EstimateRemindersService,
  ) {}

  @Cron('0 25 * * * *', {
    name: 'estimate-reminders',
    timeZone: 'UTC',
    waitForCompletion: true,
  })
  async processEstimateReminders(): Promise<void> {
    this.logger.log('Starting scheduled estimate reminder sweep');

    try {
      const result =
        await this.estimateRemindersService.processAllOrganizations();

      this.logger.log(
        [
          'Estimate reminder sweep completed',
          `organizations=${result.organizationsProcessed}/${result.organizationsScanned}`,
          `estimates=${result.estimatesScanned}`,
          `sent=${result.remindersSent}`,
          `skipped=${result.skipped}`,
          `failures=${result.failures.length}`,
        ].join(' '),
      );

      for (const failure of result.failures) {
        this.logger.warn(
          `Estimate reminder failure organization=${failure.organizationId}: ${failure.message}`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Scheduled estimate reminder sweep failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
