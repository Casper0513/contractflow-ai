import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CustomerActivityType,
  EstimateReminderType,
  EstimateStatus,
  Prisma,
  prisma,
} from '@contractflow/db';

import { ActivityService } from '../activity/activity.service';
import type { Environment } from '../config/environment';
import { EmailService } from '../email/email.service';

const reminderEstimateSelect = {
  id: true,
  organizationId: true,
  customerId: true,

  number: true,
  status: true,

  sentAt: true,
  validUntil: true,

  totalCents: true,

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
      currency: true,
    },
  },
} satisfies Prisma.EstimateSelect;

type ReminderEstimate = Prisma.EstimateGetPayload<{
  select: typeof reminderEstimateSelect;
}>;

type ReminderDecision = {
  type: EstimateReminderType;
  scheduledFor: Date;
};

type ProcessingFailure = {
  estimateNumber: string;
  message: string;
};

const FIRST_FOLLOW_UP_DAYS = 3;
const SECOND_FOLLOW_UP_DAYS = 7;

@Injectable()
export class EstimateRemindersService {
  constructor(
    private readonly emailService: EmailService,
    private readonly activityService: ActivityService,
    private readonly configService: ConfigService<Environment, true>,
  ) {}

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
    let estimatesScanned = 0;
    let remindersSent = 0;
    let skipped = 0;

    const failures: Array<{
      organizationId: string;
      message: string;
    }> = [];

    for (const organization of organizations) {
      try {
        const result = await this.processOrganization(organization.id);

        organizationsProcessed += 1;
        estimatesScanned += result.scanned;
        remindersSent += result.remindersSent;
        skipped += result.skipped;

        for (const failure of result.failures) {
          failures.push({
            organizationId: organization.id,
            message: `${failure.estimateNumber}: ${failure.message}`,
          });
        }
      } catch (error) {
        failures.push({
          organizationId: organization.id,
          message: getErrorMessage(error),
        });
      }
    }

    return {
      organizationsScanned: organizations.length,
      organizationsProcessed,
      estimatesScanned,
      remindersSent,
      skipped,
      failures,
    };
  }

  async processOrganization(organizationId: string) {
    const estimates = await prisma.estimate.findMany({
      where: {
        organizationId,

        sentAt: {
          not: null,
        },

        publicAccessToken: {
          not: null,
        },

        status: {
          in: [EstimateStatus.SENT, EstimateStatus.VIEWED],
        },

        customer: {
          email: {
            not: null,
          },
        },
      },

      orderBy: {
        sentAt: 'asc',
      },

      select: reminderEstimateSelect,
    });

    let remindersSent = 0;
    let skipped = 0;

    const failures: ProcessingFailure[] = [];

    for (const estimate of estimates) {
      try {
        const sent = await this.processEstimate(estimate);

        if (sent) {
          remindersSent += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        failures.push({
          estimateNumber: estimate.number,
          message: getErrorMessage(error),
        });
      }
    }

    return {
      organizationId,
      scanned: estimates.length,
      remindersSent,
      skipped,
      failures,
    };
  }

  private async processEstimate(estimate: ReminderEstimate): Promise<boolean> {
    if (!estimate.sentAt) {
      return false;
    }

    const email = estimate.customer.email?.trim();

    if (!email) {
      return false;
    }

    if (!estimate.publicAccessToken) {
      return false;
    }

    const timezone = estimate.organization.timezone || 'America/Edmonton';

    const todayKey = getDateKey(new Date(), timezone);

    const sentDateKey = getStoredDateKey(estimate.sentAt);

    const daysSinceSent = differenceInCalendarDays(todayKey, sentDateKey);

    /*
     * Never send a reminder once the estimate's
     * valid-until date has passed.
     */
    if (estimate.validUntil) {
      const validUntilKey = getStoredDateKey(estimate.validUntil);

      if (differenceInCalendarDays(validUntilKey, todayKey) < 0) {
        return false;
      }
    }

    const decision = this.getReminderDecision({
      sentDateKey,
      daysSinceSent,
    });

    if (!decision) {
      return false;
    }

    const reminder = await prisma.estimateReminder.upsert({
      where: {
        estimateId_type: {
          estimateId: estimate.id,
          type: decision.type,
        },
      },

      create: {
        organizationId: estimate.organizationId,

        estimateId: estimate.id,

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
      return false;
    }

    /*
     * Re-check lifecycle state immediately before delivery.
     * This prevents a race where the customer approves,
     * declines, or the scheduler expires the estimate
     * after it was initially selected.
     */
    const current = await prisma.estimate.findFirst({
      where: {
        id: estimate.id,
        organizationId: estimate.organizationId,

        status: {
          in: [EstimateStatus.SENT, EstimateStatus.VIEWED],
        },

        publicAccessToken: estimate.publicAccessToken,
      },

      select: {
        id: true,
        validUntil: true,
      },
    });

    if (!current) {
      return false;
    }

    if (current.validUntil) {
      const currentValidUntilKey = getStoredDateKey(current.validUntil);

      if (differenceInCalendarDays(currentValidUntilKey, todayKey) < 0) {
        return false;
      }
    }

    const webUrl = this.configService.get('WEB_URL', {
      infer: true,
    });

    const publicEstimateUrl = new URL(
      `/e/${estimate.publicAccessToken}`,
      webUrl,
    ).toString();

    const businessName =
      estimate.organization.legalName || estimate.organization.name;

    const customerName = getCustomerName(estimate);

    await this.emailService.send({
      to: email,

      subject: this.getReminderSubject(decision.type, estimate.number),

      html: this.buildReminderEmailHtml({
        estimate,
        businessName,
        customerName,
        publicEstimateUrl,
        type: decision.type,
      }),

      text: this.buildReminderEmailText({
        estimate,
        businessName,
        customerName,
        publicEstimateUrl,
        type: decision.type,
      }),

      replyTo: estimate.organization.email ?? undefined,

      idempotencyKey: `estimate-reminder/${estimate.id}/${decision.type}`,
    });

    const sentAt = new Date();

    await prisma.$transaction(async (tx) => {
      const updated = await tx.estimateReminder.updateMany({
        where: {
          id: reminder.id,
          sentAt: null,
        },

        data: {
          sentAt,
        },
      });

      if (updated.count !== 1) {
        return;
      }

      await this.activityService.recordCustomerActivity(
        {
          organizationId: estimate.organizationId,

          customerId: estimate.customerId,

          actorUserId: null,

          type: CustomerActivityType.ESTIMATE_SENT,

          title: 'Estimate follow-up sent',

          description: `${estimate.number} follow-up reminder was sent to the customer.`,

          metadata: {
            estimateId: estimate.id,

            estimateNumber: estimate.number,

            reminderType: decision.type,

            scheduledFor: decision.scheduledFor.toISOString(),

            source: 'estimate_reminder_engine',
          },
        },

        tx,
      );
    });

    return true;
  }

  private getReminderDecision({
    sentDateKey,
    daysSinceSent,
  }: {
    sentDateKey: string;
    daysSinceSent: number;
  }): ReminderDecision | null {
    /*
     * Threshold-based decisions allow the scheduler
     * to catch up after downtime.
     *
     * Only ONE stage is selected per run.
     */
    if (daysSinceSent >= SECOND_FOLLOW_UP_DAYS) {
      return {
        type: EstimateReminderType.SECOND_FOLLOW_UP,

        scheduledFor: dateKeyToUtcDate(
          addDaysToDateKey(sentDateKey, SECOND_FOLLOW_UP_DAYS),
        ),
      };
    }

    if (daysSinceSent >= FIRST_FOLLOW_UP_DAYS) {
      return {
        type: EstimateReminderType.FIRST_FOLLOW_UP,

        scheduledFor: dateKeyToUtcDate(
          addDaysToDateKey(sentDateKey, FIRST_FOLLOW_UP_DAYS),
        ),
      };
    }

    return null;
  }

  private getReminderSubject(
    type: EstimateReminderType,
    estimateNumber: string,
  ) {
    switch (type) {
      case EstimateReminderType.FIRST_FOLLOW_UP:
        return `Friendly reminder: ${estimateNumber} is ready for review`;

      case EstimateReminderType.SECOND_FOLLOW_UP:
        return `Reminder: ${estimateNumber} is awaiting your response`;
    }
  }

  private buildReminderEmailHtml({
    estimate,
    businessName,
    customerName,
    publicEstimateUrl,
    type,
  }: {
    estimate: ReminderEstimate;
    businessName: string;
    customerName: string;
    publicEstimateUrl: string;
    type: EstimateReminderType;
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
                            Estimate
                          </td>

                          <td align="right" style="padding:10px 0;font-weight:700;">
                            ${escapeHtml(estimate.number)}
                          </td>
                        </tr>

                        <tr>
                          <td style="padding:10px 0;color:#71717a;border-top:1px solid #e4e4e7;">
                            Estimate total
                          </td>

                          <td align="right" style="padding:10px 0;font-weight:700;border-top:1px solid #e4e4e7;">
                            ${escapeHtml(
                              formatMoney(
                                estimate.totalCents,
                                estimate.organization.currency,
                              ),
                            )}
                          </td>
                        </tr>

                        ${
                          estimate.validUntil
                            ? `
                              <tr>
                                <td style="padding:10px 0;color:#71717a;border-top:1px solid #e4e4e7;">
                                  Valid until
                                </td>

                                <td align="right" style="padding:10px 0;font-weight:700;border-top:1px solid #e4e4e7;">
                                  ${escapeHtml(formatDate(estimate.validUntil))}
                                </td>
                              </tr>
                            `
                            : ''
                        }
                      </table>

                      <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:28px;">
                        <tr>
                          <td style="border-radius:8px;background:#18181b;">
                            <a
                              href="${escapeHtml(publicEstimateUrl)}"
                              style="display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;"
                            >
                              Review Estimate
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:28px 0 0;line-height:1.6;color:#71717a;font-size:13px;">
                        If you have already responded to this estimate, please disregard this reminder.
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
    estimate,
    businessName,
    customerName,
    publicEstimateUrl,
    type,
  }: {
    estimate: ReminderEstimate;
    businessName: string;
    customerName: string;
    publicEstimateUrl: string;
    type: EstimateReminderType;
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
      `Estimate: ${estimate.number}`,
      `Estimate total: ${formatMoney(
        estimate.totalCents,
        estimate.organization.currency,
      )}`,
      ...(estimate.validUntil
        ? [`Valid until: ${formatDate(estimate.validUntil)}`]
        : []),
      '',
      `Review estimate: ${publicEstimateUrl}`,
      '',
      'If you have already responded to this estimate, please disregard this reminder.',
    ].join('\n');
  }
}

function getReminderHeading(type: EstimateReminderType) {
  switch (type) {
    case EstimateReminderType.FIRST_FOLLOW_UP:
      return 'A quick reminder about your estimate';

    case EstimateReminderType.SECOND_FOLLOW_UP:
      return 'Your estimate is still awaiting a response';
  }
}

function getReminderIntroduction(type: EstimateReminderType) {
  switch (type) {
    case EstimateReminderType.FIRST_FOLLOW_UP:
      return 'This is a friendly follow-up on the estimate we recently sent. You can review, approve, or decline it online.';

    case EstimateReminderType.SECOND_FOLLOW_UP:
      return 'We wanted to follow up once more on the estimate below. Please review it when you have a moment.';
  }
}

function getCustomerName(estimate: ReminderEstimate) {
  const name = [estimate.customer.firstName, estimate.customer.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return name || estimate.customer.companyName || 'there';
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
    : 'Unknown estimate reminder processing error';
}
