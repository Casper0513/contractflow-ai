jest.mock('../estimate-reminders/estimate-reminders.service', () => ({
  EstimateRemindersService: class EstimateRemindersService {},
}));

jest.mock('../invoice-reminders/invoice-reminders.service', () => ({
  InvoiceRemindersService: class InvoiceRemindersService {},
}));

jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

jest.mock('../payments/stripe-payment.service', () => ({
  StripePaymentService: class StripePaymentService {},
}));

jest.mock('../estimates/estimates.service', () => ({
  EstimatesService: class EstimatesService {},
}));

import { EstimateRemindersScheduler } from '../estimate-reminders/estimate-reminders.scheduler';
import { EstimateExpirationScheduler } from '../estimates/estimate-expiration.scheduler';
import { InvoiceRemindersScheduler } from '../invoice-reminders/invoice-reminders.scheduler';
import { NotificationsScheduler } from '../notifications/notifications.scheduler';
import { PaymentReceiptScheduler } from '../payments/payment-receipt.scheduler';

function loggerFor(service: unknown) {
  return (
    service as {
      logger: {
        error: (...args: unknown[]) => void;
        warn: (...args: unknown[]) => void;
      };
    }
  ).logger;
}

describe('scheduler logging sanitization', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sanitizes payment receipt scheduler failures', async () => {
    const scheduler = new PaymentReceiptScheduler({
      processPendingReceiptDeliveries: jest
        .fn()
        .mockRejectedValue(
          new Error('provider secret for payment pay_sensitive'),
        ),
    } as never);

    const loggerError = jest
      .spyOn(loggerFor(scheduler), 'error')
      .mockImplementation(() => undefined);

    await scheduler.retryPaymentReceipts();

    expect(loggerError).toHaveBeenCalledWith(
      'Payment receipt retry sweep failed',
    );

    const logged = loggerError.mock.calls.flat().join(' ');

    expect(logged).not.toContain('provider secret');
    expect(logged).not.toContain('pay_sensitive');
  });

  it('sanitizes invoice reminder failure warnings and sweep errors', async () => {
    const processAllOrganizations = jest
      .fn()
      .mockResolvedValueOnce({
        organizationsProcessed: 0,
        organizationsScanned: 1,
        invoicesScanned: 1,
        remindersSent: 0,
        skipped: 0,
        overdueMarked: 0,
        failures: [
          {
            organizationId: 'org_sensitive',
            message: 'sensitive invoice provider error',
          },
        ],
      })
      .mockRejectedValueOnce(new Error('raw invoice scheduler failure'));

    const scheduler = new InvoiceRemindersScheduler({
      processAllOrganizations,
    } as never);

    const loggerWarn = jest
      .spyOn(loggerFor(scheduler), 'warn')
      .mockImplementation(() => undefined);

    const loggerError = jest
      .spyOn(loggerFor(scheduler), 'error')
      .mockImplementation(() => undefined);

    await scheduler.processInvoiceReminders();

    expect(loggerWarn).toHaveBeenCalledWith(
      'Invoice reminder processing failure',
    );

    let logged = loggerWarn.mock.calls.flat().join(' ');

    expect(logged).not.toContain('org_sensitive');
    expect(logged).not.toContain('sensitive invoice provider error');

    await scheduler.processInvoiceReminders();

    expect(loggerError).toHaveBeenCalledWith(
      'Scheduled invoice reminder sweep failed',
    );

    logged = loggerError.mock.calls.flat().join(' ');

    expect(logged).not.toContain('raw invoice scheduler failure');
  });

  it('sanitizes estimate reminder failure warnings and sweep errors', async () => {
    const processAllOrganizations = jest
      .fn()
      .mockResolvedValueOnce({
        organizationsProcessed: 0,
        organizationsScanned: 1,
        estimatesScanned: 1,
        remindersSent: 0,
        skipped: 0,
        failures: [
          {
            organizationId: 'org_sensitive',
            message: 'sensitive estimate provider error',
          },
        ],
      })
      .mockRejectedValueOnce(new Error('raw estimate scheduler failure'));

    const scheduler = new EstimateRemindersScheduler({
      processAllOrganizations,
    } as never);

    const loggerWarn = jest
      .spyOn(loggerFor(scheduler), 'warn')
      .mockImplementation(() => undefined);

    const loggerError = jest
      .spyOn(loggerFor(scheduler), 'error')
      .mockImplementation(() => undefined);

    await scheduler.processEstimateReminders();

    expect(loggerWarn).toHaveBeenCalledWith(
      'Estimate reminder processing failure',
    );

    let logged = loggerWarn.mock.calls.flat().join(' ');

    expect(logged).not.toContain('org_sensitive');
    expect(logged).not.toContain('sensitive estimate provider error');

    await scheduler.processEstimateReminders();

    expect(loggerError).toHaveBeenCalledWith(
      'Scheduled estimate reminder sweep failed',
    );

    logged = loggerError.mock.calls.flat().join(' ');

    expect(logged).not.toContain('raw estimate scheduler failure');
  });

  it('sanitizes estimate expiration failure warnings and sweep errors', async () => {
    const processExpiredEstimates = jest
      .fn()
      .mockResolvedValueOnce({
        scanned: 1,
        expired: 0,
        skipped: 0,
        failures: [
          {
            estimateId: 'estimate_sensitive',
            message: 'sensitive expiration error',
          },
        ],
      })
      .mockRejectedValueOnce(new Error('raw expiration scheduler failure'));

    const scheduler = new EstimateExpirationScheduler({
      processExpiredEstimates,
    } as never);

    const loggerWarn = jest
      .spyOn(loggerFor(scheduler), 'warn')
      .mockImplementation(() => undefined);

    const loggerError = jest
      .spyOn(loggerFor(scheduler), 'error')
      .mockImplementation(() => undefined);

    await scheduler.processExpiredEstimates();

    expect(loggerWarn).toHaveBeenCalledWith(
      'Estimate expiration processing failure',
    );

    let logged = loggerWarn.mock.calls.flat().join(' ');

    expect(logged).not.toContain('estimate_sensitive');
    expect(logged).not.toContain('sensitive expiration error');

    await scheduler.processExpiredEstimates();

    expect(loggerError).toHaveBeenCalledWith(
      'Scheduled estimate expiration sweep failed',
    );

    logged = loggerError.mock.calls.flat().join(' ');

    expect(logged).not.toContain('raw expiration scheduler failure');
  });

  it('sanitizes notification failure warnings and sweep errors', async () => {
    const processFollowUpNotifications = jest
      .fn()
      .mockResolvedValueOnce({
        scanned: 1,
        dueTodayCreated: 0,
        overdueCreated: 0,
        skipped: 0,
        failures: [
          {
            followUpId: 'followup_sensitive',
            message: 'sensitive notification error',
          },
        ],
      })
      .mockRejectedValueOnce(new Error('raw notification scheduler failure'));

    const scheduler = new NotificationsScheduler({
      processFollowUpNotifications,
    } as never);

    const loggerWarn = jest
      .spyOn(loggerFor(scheduler), 'warn')
      .mockImplementation(() => undefined);

    const loggerError = jest
      .spyOn(loggerFor(scheduler), 'error')
      .mockImplementation(() => undefined);

    await scheduler.processFollowUpNotifications();

    expect(loggerWarn).toHaveBeenCalledWith(
      'Follow-up notification processing failure',
    );

    let logged = loggerWarn.mock.calls.flat().join(' ');

    expect(logged).not.toContain('followup_sensitive');
    expect(logged).not.toContain('sensitive notification error');

    await scheduler.processFollowUpNotifications();

    expect(loggerError).toHaveBeenCalledWith(
      'Scheduled follow-up notification sweep failed',
    );

    logged = loggerError.mock.calls.flat().join(' ');

    expect(logged).not.toContain('raw notification scheduler failure');
  });
});
