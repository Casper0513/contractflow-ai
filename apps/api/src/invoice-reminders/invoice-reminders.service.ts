import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CustomerActivityType,
  InvoiceReminderType,
  InvoiceStatus,
  Prisma,
  prisma,
} from '@contractflow/db';

import { ActivityService } from '../activity/activity.service';
import type { Environment } from '../config/environment';
import { EmailService } from '../email/email.service';

const reminderInvoiceSelect = {
  id: true,
  organizationId: true,
  customerId: true,

  number: true,
  status: true,

  currency: true,

  dueDate: true,

  totalCents: true,
  amountPaidCents: true,
  balanceDueCents: true,

  publicAccessToken: true,

  customer: {
    select: {
      firstName: true,
      lastName: true,
      companyName: true,
      email: true,
    },
  },

  organization: {
    select: {
      name: true,
      legalName: true,
      email: true,
      timezone: true,

      invoiceReminderSettings: {
        select: {
          enabled: true,

          beforeDueEnabled: true,
          beforeDueDays: true,

          dueTodayEnabled: true,

          firstOverdueEnabled: true,
          firstOverdueDays: true,

          secondOverdueEnabled: true,
          secondOverdueDays: true,
        },
      },
    },
  },
} satisfies Prisma.InvoiceSelect;

type ReminderInvoice = Prisma.InvoiceGetPayload<{
  select: typeof reminderInvoiceSelect;
}>;

type ReminderSettings = {
  enabled: boolean;

  beforeDueEnabled: boolean;
  beforeDueDays: number;

  dueTodayEnabled: boolean;

  firstOverdueEnabled: boolean;
  firstOverdueDays: number;

  secondOverdueEnabled: boolean;
  secondOverdueDays: number;
};

type ReminderDecision = {
  type: InvoiceReminderType;
  scheduledFor: Date;
};

type ProcessingFailure = {
  invoiceNumber: string;
  message: string;
};

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: true,

  beforeDueEnabled: true,
  beforeDueDays: 3,

  dueTodayEnabled: true,

  firstOverdueEnabled: true,
  firstOverdueDays: 3,

  secondOverdueEnabled: true,
  secondOverdueDays: 7,
};

@Injectable()
export class InvoiceRemindersService {
  constructor(
    private readonly emailService: EmailService,
    private readonly activityService: ActivityService,
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  async processForUser(clerkUserId: string) {
    const organizationId = await this.getOrganizationIdForUser(clerkUserId);

    return this.processOrganization(organizationId);
  }

  async processAllOrganizations() {
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    let organizationsProcessed = 0;
    let invoicesScanned = 0;
    let remindersSent = 0;
    let skipped = 0;
    let overdueMarked = 0;

    const failures: Array<{
      organizationId: string;
      message: string;
    }> = [];

    for (const organization of organizations) {
      try {
        const result = await this.processOrganization(organization.id);

        organizationsProcessed += 1;
        invoicesScanned += result.scanned;
        remindersSent += result.remindersSent;
        skipped += result.skipped;
        overdueMarked += result.overdueMarked;

        for (const failure of result.failures) {
          failures.push({
            organizationId: organization.id,
            message: `${failure.invoiceNumber}: ${failure.message}`,
          });
        }
      } catch (error) {
        console.error(
          `Invoice reminder processing failed for organization ${organization.id}`,
          error,
        );

        failures.push({
          organizationId: organization.id,
          message: getErrorMessage(error),
        });
      }
    }

    return {
      organizationsScanned: organizations.length,
      organizationsProcessed,
      invoicesScanned,
      remindersSent,
      skipped,
      overdueMarked,
      failures,
    };
  }

  async processOrganization(organizationId: string) {
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,

        dueDate: {
          not: null,
        },

        balanceDueCents: {
          gt: 0,
        },

        publicAccessToken: {
          not: null,
        },

        status: {
          in: [
            InvoiceStatus.SENT,
            InvoiceStatus.VIEWED,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.OVERDUE,
          ],
        },

        customer: {
          email: {
            not: null,
          },
        },
      },

      orderBy: {
        dueDate: 'asc',
      },

      select: reminderInvoiceSelect,
    });

    let remindersSent = 0;
    let skipped = 0;
    let overdueMarked = 0;

    const failures: ProcessingFailure[] = [];

    for (const invoice of invoices) {
      try {
        const result = await this.processInvoice(invoice);

        if (result.reminderSent) {
          remindersSent += 1;
        } else {
          skipped += 1;
        }

        if (result.overdueMarked) {
          overdueMarked += 1;
        }
      } catch (error) {
        console.error(
          `Invoice reminder processing failed for ${invoice.number}`,
          error,
        );

        failures.push({
          invoiceNumber: invoice.number,
          message: getErrorMessage(error),
        });
      }
    }

    return {
      organizationId,

      scanned: invoices.length,
      remindersSent,
      skipped,
      overdueMarked,

      failures,
    };
  }

  private async processInvoice(invoice: ReminderInvoice): Promise<{
    reminderSent: boolean;
    overdueMarked: boolean;
  }> {
    if (!invoice.dueDate) {
      return {
        reminderSent: false,
        overdueMarked: false,
      };
    }

    const email = invoice.customer.email?.trim();

    if (!email) {
      return {
        reminderSent: false,
        overdueMarked: false,
      };
    }

    if (!invoice.publicAccessToken) {
      return {
        reminderSent: false,
        overdueMarked: false,
      };
    }

    const settings = this.resolveSettings(
      invoice.organization.invoiceReminderSettings,
    );

    if (!settings.enabled) {
      return {
        reminderSent: false,
        overdueMarked: false,
      };
    }

    const timezone = invoice.organization.timezone || 'America/Edmonton';

    const todayKey = getDateKey(new Date(), timezone);

    const dueDateKey = getStoredDateKey(invoice.dueDate);

    const daysUntilDue = differenceInCalendarDays(dueDateKey, todayKey);

    let overdueMarked = false;

    if (daysUntilDue < 0) {
      overdueMarked = await this.markOverdueIfNeeded(invoice);
    }

    const decision = this.getReminderDecision({
      settings,
      dueDateKey,
      daysUntilDue,
    });

    if (!decision) {
      return {
        reminderSent: false,
        overdueMarked,
      };
    }

    const reminder = await prisma.invoiceReminder.upsert({
      where: {
        invoiceId_type: {
          invoiceId: invoice.id,
          type: decision.type,
        },
      },

      create: {
        organizationId: invoice.organizationId,

        invoiceId: invoice.id,

        type: decision.type,

        scheduledFor: decision.scheduledFor,
      },

      update: {},

      select: {
        id: true,
        sentAt: true,
      },
    });

    if (reminder.sentAt) {
      return {
        reminderSent: false,
        overdueMarked,
      };
    }

    const webUrl = this.configService.get('WEB_URL', {
      infer: true,
    });

    const publicInvoiceUrl = new URL(
      `/i/${invoice.publicAccessToken}`,
      webUrl,
    ).toString();

    const businessName =
      invoice.organization.legalName || invoice.organization.name;

    const customerName = getCustomerName(invoice);

    await this.emailService.send({
      to: email,

      subject: this.getReminderSubject(decision.type, invoice.number),

      html: this.buildReminderEmailHtml({
        invoice,
        businessName,
        customerName,
        publicInvoiceUrl,
        type: decision.type,
      }),

      text: this.buildReminderEmailText({
        invoice,
        businessName,
        customerName,
        publicInvoiceUrl,
        type: decision.type,
      }),

      replyTo: invoice.organization.email ?? undefined,

      /*
       * Database uniqueness prevents duplicate
       * reminder records.
       *
       * Resend's deterministic idempotency key
       * provides a second protection layer if
       * two workers attempt delivery concurrently.
       */
      idempotencyKey: `invoice-reminder/${invoice.id}/${decision.type}`,
    });

    await prisma.invoiceReminder.updateMany({
      where: {
        id: reminder.id,
        sentAt: null,
      },

      data: {
        sentAt: new Date(),
      },
    });

    return {
      reminderSent: true,
      overdueMarked,
    };
  }

  private async markOverdueIfNeeded(
    invoice: ReminderInvoice,
  ): Promise<boolean> {
    if (invoice.status === InvoiceStatus.OVERDUE) {
      return false;
    }

    if (invoice.status === InvoiceStatus.PAID) {
      return false;
    }

    if (invoice.status === InvoiceStatus.VOIDED) {
      return false;
    }

    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const result = await tx.invoice.updateMany({
        where: {
          id: invoice.id,

          organizationId: invoice.organizationId,

          balanceDueCents: {
            gt: 0,
          },

          status: {
            in: [
              InvoiceStatus.SENT,
              InvoiceStatus.VIEWED,
              InvoiceStatus.PARTIALLY_PAID,
            ],
          },
        },

        data: {
          status: InvoiceStatus.OVERDUE,

          overdueAt: now,
        },
      });

      if (result.count !== 1) {
        return false;
      }

      await this.activityService.recordCustomerActivity(
        {
          organizationId: invoice.organizationId,

          customerId: invoice.customerId,

          actorUserId: null,

          type: CustomerActivityType.INVOICE_OVERDUE,

          title: 'Invoice marked overdue',

          description: `${invoice.number} was automatically marked overdue.`,

          metadata: {
            invoiceId: invoice.id,

            invoiceNumber: invoice.number,

            previousStatus: invoice.status,

            status: InvoiceStatus.OVERDUE,

            source: 'invoice_reminder_engine',
          },
        },

        tx,
      );

      return true;
    });
  }

  private getReminderDecision({
    settings,
    dueDateKey,
    daysUntilDue,
  }: {
    settings: ReminderSettings;
    dueDateKey: string;
    daysUntilDue: number;
  }): ReminderDecision | null {
    /*
     * Overdue reminders use a threshold instead
     * of exact equality so a scheduler that misses
     * a day can safely catch up.
     *
     * We choose only ONE reminder stage per invoice
     * per run. For example, an invoice first seen
     * ten days late receives SECOND_OVERDUE rather
     * than both overdue emails at once.
     */
    if (daysUntilDue < 0) {
      const daysOverdue = Math.abs(daysUntilDue);

      if (
        settings.secondOverdueEnabled &&
        daysOverdue >= settings.secondOverdueDays
      ) {
        return {
          type: InvoiceReminderType.SECOND_OVERDUE,

          scheduledFor: dateKeyToUtcDate(
            addDaysToDateKey(dueDateKey, settings.secondOverdueDays),
          ),
        };
      }

      if (
        settings.firstOverdueEnabled &&
        daysOverdue >= settings.firstOverdueDays
      ) {
        return {
          type: InvoiceReminderType.FIRST_OVERDUE,

          scheduledFor: dateKeyToUtcDate(
            addDaysToDateKey(dueDateKey, settings.firstOverdueDays),
          ),
        };
      }

      return null;
    }

    if (daysUntilDue === 0 && settings.dueTodayEnabled) {
      return {
        type: InvoiceReminderType.DUE_TODAY,

        scheduledFor: dateKeyToUtcDate(dueDateKey),
      };
    }

    if (
      settings.beforeDueEnabled &&
      daysUntilDue > 0 &&
      daysUntilDue <= settings.beforeDueDays
    ) {
      return {
        type: InvoiceReminderType.BEFORE_DUE,

        scheduledFor: dateKeyToUtcDate(
          addDaysToDateKey(dueDateKey, -settings.beforeDueDays),
        ),
      };
    }

    return null;
  }

  private resolveSettings(settings: ReminderSettings | null): ReminderSettings {
    return settings ?? DEFAULT_SETTINGS;
  }

  private getReminderSubject(type: InvoiceReminderType, invoiceNumber: string) {
    switch (type) {
      case InvoiceReminderType.BEFORE_DUE:
        return `Friendly reminder: ${invoiceNumber} is due soon`;

      case InvoiceReminderType.DUE_TODAY:
        return `Payment reminder: ${invoiceNumber} is due today`;

      case InvoiceReminderType.FIRST_OVERDUE:
        return `Payment overdue: ${invoiceNumber}`;

      case InvoiceReminderType.SECOND_OVERDUE:
        return `Reminder: ${invoiceNumber} remains overdue`;
    }
  }

  private buildReminderEmailHtml({
    invoice,
    businessName,
    customerName,
    publicInvoiceUrl,
    type,
  }: {
    invoice: ReminderInvoice;
    businessName: string;
    customerName: string;
    publicInvoiceUrl: string;
    type: InvoiceReminderType;
  }) {
    const heading = getReminderHeading(type);

    const introduction = getReminderIntroduction(type);

    return `
      <!doctype html>
      <html>
        <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;">
                  <tr>
                    <td style="padding:32px;">
                      <p style="margin:0 0 8px;font-size:14px;color:#71717a;">
                        ${escapeHtml(businessName)}
                      </p>

                      <h1 style="margin:0;font-size:24px;line-height:1.3;">
                        ${escapeHtml(heading)}
                      </h1>

                      <p style="margin:24px 0 0;line-height:1.6;color:#52525b;">
                        Hi ${escapeHtml(customerName)},
                      </p>

                      <p style="margin:12px 0 0;line-height:1.6;color:#52525b;">
                        ${escapeHtml(introduction)}
                      </p>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border-collapse:collapse;">
                        <tr>
                          <td style="padding:10px 0;color:#71717a;">
                            Invoice
                          </td>

                          <td align="right" style="padding:10px 0;font-weight:700;">
                            ${escapeHtml(invoice.number)}
                          </td>
                        </tr>

                        <tr>
                          <td style="padding:10px 0;color:#71717a;border-top:1px solid #e4e4e7;">
                            Due date
                          </td>

                          <td align="right" style="padding:10px 0;font-weight:700;border-top:1px solid #e4e4e7;">
                            ${escapeHtml(formatDate(invoice.dueDate!))}
                          </td>
                        </tr>

                        <tr>
                          <td style="padding:10px 0;color:#71717a;border-top:1px solid #e4e4e7;">
                            Balance due
                          </td>

                          <td align="right" style="padding:10px 0;font-weight:700;border-top:1px solid #e4e4e7;">
                            ${escapeHtml(
                              formatMoney(
                                invoice.balanceDueCents,
                                invoice.currency,
                              ),
                            )}
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:28px;">
                        <tr>
                          <td style="border-radius:8px;background:#18181b;">
                            <a
                              href="${escapeHtml(publicInvoiceUrl)}"
                              style="display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;"
                            >
                              View and Pay Invoice
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:28px 0 0;line-height:1.6;color:#71717a;font-size:13px;">
                        If you have already made this payment, please disregard this reminder.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  private buildReminderEmailText({
    invoice,
    businessName,
    customerName,
    publicInvoiceUrl,
    type,
  }: {
    invoice: ReminderInvoice;
    businessName: string;
    customerName: string;
    publicInvoiceUrl: string;
    type: InvoiceReminderType;
  }) {
    return [
      businessName,
      '',
      getReminderHeading(type),
      '',
      `Hi ${customerName},`,
      '',
      getReminderIntroduction(type),
      '',
      `Invoice: ${invoice.number}`,
      `Due date: ${formatDate(invoice.dueDate!)}`,
      `Balance due: ${formatMoney(invoice.balanceDueCents, invoice.currency)}`,
      '',
      `View and pay invoice: ${publicInvoiceUrl}`,
      '',
      'If you have already made this payment, please disregard this reminder.',
    ].join('\n');
  }

  private async getOrganizationIdForUser(clerkUserId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: {
        clerkUserId,
      },

      select: {
        memberships: {
          orderBy: {
            createdAt: 'asc',
          },

          take: 1,

          select: {
            organizationId: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(
        'Authenticated user has not been synchronized',
      );
    }

    const membership = user.memberships[0];

    if (!membership) {
      throw new NotFoundException('Organization membership not found');
    }

    return membership.organizationId;
  }
}

function getReminderHeading(type: InvoiceReminderType) {
  switch (type) {
    case InvoiceReminderType.BEFORE_DUE:
      return 'Your invoice is due soon';

    case InvoiceReminderType.DUE_TODAY:
      return 'Your invoice is due today';

    case InvoiceReminderType.FIRST_OVERDUE:
      return 'Your invoice is overdue';

    case InvoiceReminderType.SECOND_OVERDUE:
      return 'Your invoice remains overdue';
  }
}

function getReminderIntroduction(type: InvoiceReminderType) {
  switch (type) {
    case InvoiceReminderType.BEFORE_DUE:
      return 'This is a friendly reminder that the following invoice is approaching its due date.';

    case InvoiceReminderType.DUE_TODAY:
      return 'This is a reminder that the following invoice is due today.';

    case InvoiceReminderType.FIRST_OVERDUE:
      return 'Our records show that the following invoice has passed its due date and still has an outstanding balance.';

    case InvoiceReminderType.SECOND_OVERDUE:
      return 'The following invoice remains unpaid. Please review the outstanding balance when you have a moment.';
  }
}

function getCustomerName(invoice: ReminderInvoice) {
  const name = [invoice.customer.firstName, invoice.customer.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return name || invoice.customer.companyName || 'there';
}

function getStoredDateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function getDateKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;

  const month = parts.find((part) => part.type === 'month')?.value;

  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Unable to determine local calendar date');
  }

  return `${year}-${month}-${day}`;
}

function differenceInCalendarDays(
  laterDateKey: string,
  earlierDateKey: string,
) {
  const later = dateKeyToUtcDate(laterDateKey);

  const earlier = dateKeyToUtcDate(earlierDateKey);

  return Math.round((later.getTime() - earlier.getTime()) / 86_400_000);
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = dateKeyToUtcDate(dateKey);

  date.setUTCDate(date.getUTCDate() + days);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function dateKeyToUtcDate(dateKey: string) {
  const [yearValue, monthValue, dayValue] = dateKey.split('-');

  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    throw new Error('Invalid calendar date');
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Unknown reminder processing error';
}
