import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { InvoiceRemindersService } from './invoice-reminders.service';

@Injectable()
export class InvoiceRemindersScheduler {
  private readonly logger = new Logger(InvoiceRemindersScheduler.name);

  constructor(
    private readonly invoiceRemindersService: InvoiceRemindersService,
  ) {}

  @Cron('0 15 * * * *', {
    name: 'invoice-reminders',
    timeZone: 'UTC',
    waitForCompletion: true,
  })
  async processInvoiceReminders(): Promise<void> {
    this.logger.log('Starting scheduled invoice reminder sweep');

    try {
      const result =
        await this.invoiceRemindersService.processAllOrganizations();

      this.logger.log(
        [
          'Invoice reminder sweep completed',
          `organizations=${result.organizationsProcessed}/${result.organizationsScanned}`,
          `invoices=${result.invoicesScanned}`,
          `sent=${result.remindersSent}`,
          `skipped=${result.skipped}`,
          `overdue=${result.overdueMarked}`,
          `failures=${result.failures.length}`,
        ].join(' '),
      );

      for (const failure of result.failures) {
        this.logger.warn(
          `Invoice reminder failure organization=${failure.organizationId}: ${failure.message}`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Scheduled invoice reminder sweep failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
