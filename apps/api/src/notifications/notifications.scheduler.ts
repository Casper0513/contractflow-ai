import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Cron('0 5 * * * *', {
    name: 'follow-up-notifications',
    timeZone: 'UTC',
    waitForCompletion: true,
  })
  async processFollowUpNotifications(): Promise<void> {
    this.logger.log('Starting scheduled follow-up notification sweep');

    try {
      const result =
        await this.notificationsService.processFollowUpNotifications();

      this.logger.log(
        [
          'Follow-up notification sweep completed',
          `scanned=${result.scanned}`,
          `dueToday=${result.dueTodayCreated}`,
          `overdue=${result.overdueCreated}`,
          `skipped=${result.skipped}`,
          `failures=${result.failures.length}`,
        ].join(' '),
      );

      for (const failure of result.failures) {
        this.logger.warn(
          `Follow-up notification failure followUp=${failure.followUpId}: ${failure.message}`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Scheduled follow-up notification sweep failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
