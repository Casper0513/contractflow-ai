import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CommunicationCategory,
  EstimateReminderType,
  EstimateStatus,
} from '@contractflow/db';
import {
  db,
  fromPrisma8Timestamp,
  isPrisma8UniqueViolation,
  prisma8TextParam,
  prisma8TimestampParam,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import type { Environment } from '../config/environment';
import { CustomerCommunicationsService } from '../customer-communications/customer-communications.service';
import { formatMoney as formatCurrencyAmount } from '../common/money/money';

type ReminderSettings = {
  enabled: boolean;

  firstFollowUpEnabled: boolean;
  firstFollowUpDays: number;

  secondFollowUpEnabled: boolean;
  secondFollowUpDays: number;
};

type ReminderDecision = {
  type: EstimateReminderType;
  scheduledFor: Date;
};

type ProcessingFailure = {
  estimateNumber: string;
  message: string;
};

type ReminderEstimate = {
  id: string;
  organizationId: string;
  customerId: string;

  number: string;

  status: 'SENT' | 'VIEWED';

  sentAt: Date;
  validUntil: Date | null;

  totalCents: number;
  currency: string;

  publicAccessToken: string;

  customer: {
    firstName: string;
    lastName: string | null;
    companyName: string | null;
    email: string | null;
  };

  organization: {
    name: string;
    legalName: string | null;
    email: string | null;
    timezone: string | null;
    currency: string;

    estimateReminderSettings: ReminderSettings | null;
  };
};

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: true,

  firstFollowUpEnabled: true,
  firstFollowUpDays: 3,

  secondFollowUpEnabled: true,
  secondFollowUpDays: 7,
};

@Injectable()
export class EstimateRemindersService {
  constructor(
    private readonly customerCommunicationsService: CustomerCommunicationsService,

    private readonly configService: ConfigService<Environment, true>,
  ) {}

  async processAllOrganizations() {
    const organizations = await db.orm.public.Organization.select(
      'id',
      'createdAt',
    )
      .orderBy((model) => model.createdAt.asc())
      .all();

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
    const organization = await db.orm.public.Organization.where({
      id: organizationId,
    })
      .select('name', 'legalName', 'email', 'timezone', 'currency')
      .first();

    if (!organization) {
      throw new Error('Organization not found');
    }

    const reminderSettings = await db.orm.public.EstimateReminderSettings.where(
      {
        organizationId,
      },
    )
      .select(
        'enabled',
        'firstFollowUpEnabled',
        'firstFollowUpDays',
        'secondFollowUpEnabled',
        'secondFollowUpDays',
      )
      .first();

    const sent = await this.listEstimatesByStatus(
      organizationId,
      EstimateStatus.SENT,
    );

    const viewed = await this.listEstimatesByStatus(
      organizationId,
      EstimateStatus.VIEWED,
    );

    const rawEstimates = [...sent, ...viewed]
      .filter(
        (estimate) =>
          estimate.sentAt !== null && estimate.publicAccessToken !== null,
      )
      .sort((left, right) => {
        if (left.sentAt === null || right.sentAt === null) {
          return 0;
        }

        return (
          fromPrisma8Timestamp(left.sentAt).getTime() -
          fromPrisma8Timestamp(right.sentAt).getTime()
        );
      });

    const estimates: ReminderEstimate[] = [];

    for (const estimate of rawEstimates) {
      if (!estimate.sentAt || !estimate.publicAccessToken) {
        continue;
      }

      const customer = await db.orm.public.Customer.where({
        id: estimate.customerId,
      })
        .select('firstName', 'lastName', 'companyName', 'email')
        .first();

      /*
       * The Prisma 7 query excluded NULL
       * customer email addresses.
       *
       * Empty strings remain eligible for
       * scanning and are rejected later by
       * processEstimate() after trim(), matching
       * the original behavior.
       */
      if (!customer || customer.email === null) {
        continue;
      }

      estimates.push({
        id: estimate.id,

        organizationId: estimate.organizationId,

        customerId: estimate.customerId,

        number: estimate.number,

        status: estimate.status as 'SENT' | 'VIEWED',

        sentAt: fromPrisma8Timestamp(estimate.sentAt),

        validUntil:
          estimate.validUntil === null
            ? null
            : fromPrisma8Timestamp(estimate.validUntil),

        totalCents: estimate.totalCents,

        currency: estimate.currency,

        publicAccessToken: estimate.publicAccessToken,

        customer,

        organization: {
          ...organization,

          estimateReminderSettings: reminderSettings,
        },
      });
    }

    let remindersSent = 0;
    let skipped = 0;

    const failures: ProcessingFailure[] = [];

    for (const estimate of estimates) {
      try {
        const sentReminder = await this.processEstimate(estimate);

        if (sentReminder) {
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

  private async listEstimatesByStatus(
    organizationId: string,
    status: typeof EstimateStatus.SENT | typeof EstimateStatus.VIEWED,
  ) {
    return db.orm.public.Estimate.where({
      organizationId,
      status,
    })
      .select(
        'id',
        'organizationId',
        'customerId',
        'number',
        'status',
        'sentAt',
        'validUntil',
        'totalCents',
        'currency',
        'publicAccessToken',
      )
      .orderBy((model) => model.sentAt.asc())
      .all();
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

    const settings = this.resolveSettings(
      estimate.organization.estimateReminderSettings,
    );

    if (!settings.enabled) {
      return false;
    }

    const timezone = estimate.organization.timezone || 'America/Edmonton';

    const todayKey = getDateKey(new Date(), timezone);

    const sentDateKey = getStoredDateKey(estimate.sentAt);

    const daysSinceSent = differenceInCalendarDays(todayKey, sentDateKey);

    /*
     * Never send a reminder once the estimate's
     * valid-until calendar date has passed.
     */
    if (estimate.validUntil) {
      const validUntilKey = getStoredDateKey(estimate.validUntil);

      if (differenceInCalendarDays(validUntilKey, todayKey) < 0) {
        return false;
      }
    }

    const decision = this.getReminderDecision({
      settings,
      sentDateKey,
      daysSinceSent,
    });

    if (!decision) {
      return false;
    }

    /*
     * Re-check lifecycle immediately before
     * reminder creation/delivery.
     */
    const current = await db.orm.public.Estimate.where({
      id: estimate.id,

      organizationId: estimate.organizationId,
    })
      .select('id', 'status', 'validUntil', 'publicAccessToken')
      .first();

    if (!current) {
      return false;
    }

    if (
      current.status !== EstimateStatus.SENT &&
      current.status !== EstimateStatus.VIEWED
    ) {
      return false;
    }

    if (current.publicAccessToken !== estimate.publicAccessToken) {
      return false;
    }

    if (current.validUntil) {
      const currentValidUntil = fromPrisma8Timestamp(current.validUntil);

      const currentValidUntilKey = getStoredDateKey(currentValidUntil);

      if (differenceInCalendarDays(currentValidUntilKey, todayKey) < 0) {
        return false;
      }
    }

    const reminder = await this.ensureReminder({
      organizationId: estimate.organizationId,

      estimateId: estimate.id,

      type: decision.type,

      scheduledFor: decision.scheduledFor,
    });

    if (reminder.sentAt) {
      return false;
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

    const emailSubject = this.getReminderSubject(
      decision.type,
      estimate.number,
    );

    const emailHtml = this.buildReminderEmailHtml({
      estimate,
      businessName,
      customerName,
      publicEstimateUrl,
      type: decision.type,
    });

    const emailText = this.buildReminderEmailText({
      estimate,
      businessName,
      customerName,
      publicEstimateUrl,
      type: decision.type,
    });

    await this.customerCommunicationsService.sendEmail({
      organizationId: estimate.organizationId,

      customerId: estimate.customerId,

      actorUserId: null,

      category: CommunicationCategory.REMINDER,

      recipientEmail: email,

      subject: emailSubject,

      htmlBody: emailHtml,

      textBody: emailText,

      estimateId: estimate.id,

      replyTo: estimate.organization.email ?? undefined,

      /*
       * The database unique constraint prevents
       * duplicate reminder stages per estimate.
       *
       * Communication idempotency remains the
       * second concurrent-delivery protection.
       */
      idempotencyKey: `estimate-reminder/${estimate.id}/${decision.type}`,
    });

    await db.transaction(async (tx) => {
      const sentAt = toPrisma8Timestamp();

      const plan = db.raw.sql`
            UPDATE "EstimateReminder"
            SET
              "sentAt" = ${prisma8TimestampParam(sentAt)},
              "updatedAt" = ${prisma8TimestampParam(sentAt)}
            WHERE
              "id" = ${prisma8TextParam(reminder.id)}
              AND "sentAt" IS NULL
          `
        .affectedCount()
        .build();

      const updated = await tx.execute(plan);

      if (updated.affectedRows !== 1) {
        return;
      }

      await tx.orm.public.CustomerActivity.create({
        organizationId: estimate.organizationId,

        customerId: estimate.customerId,

        actorUserId: null,

        _type: 'ESTIMATE_SENT',

        title: 'Estimate follow-up sent',

        description: `${estimate.number} follow-up reminder was sent to the customer.`,

        metadata: {
          estimateId: estimate.id,

          estimateNumber: estimate.number,

          reminderType: decision.type,

          scheduledFor: decision.scheduledFor.toISOString(),

          source: 'estimate_reminder_engine',
        },

        createdAt: sentAt,
      });
    });

    /*
     * Preserve the Prisma 7 behavior:
     * once sendEmail() succeeded, processEstimate()
     * returns true even if another worker won the
     * final sentAt compare-and-set.
     */
    return true;
  }

  private async ensureReminder({
    organizationId,
    estimateId,
    type,
    scheduledFor,
  }: {
    organizationId: string;
    estimateId: string;
    type: EstimateReminderType;
    scheduledFor: Date;
  }) {
    const existing = await this.findReminder(estimateId, type);

    if (existing) {
      return existing;
    }

    try {
      return await db.transaction(async (tx) => {
        const now = toPrisma8Timestamp();

        const created = await tx.orm.public.EstimateReminder.create({
          organizationId,

          estimateId,

          _type: type,

          scheduledFor: toPrisma8Timestamp(scheduledFor),

          sentAt: null,

          createdAt: now,

          updatedAt: now,
        });

        return {
          id: created.id,

          sentAt:
            created.sentAt === null
              ? null
              : fromPrisma8Timestamp(created.sentAt),
        };
      });
    } catch (error) {
      /*
       * Equivalent to Prisma 7 upsert race
       * behavior:
       *
       * another worker may create the same
       * compound-unique reminder after our
       * initial read but before our insert.
       */
      if (!isPrisma8UniqueViolation(error)) {
        throw error;
      }

      const winner = await this.findReminder(estimateId, type);

      if (!winner) {
        throw error;
      }

      return winner;
    }
  }

  private async findReminder(estimateId: string, type: EstimateReminderType) {
    const reminder = await db.orm.public.EstimateReminder.where({
      estimateId,

      _type: type,
    })
      .select('id', 'sentAt')
      .first();

    if (!reminder) {
      return null;
    }

    return {
      id: reminder.id,

      sentAt:
        reminder.sentAt === null ? null : fromPrisma8Timestamp(reminder.sentAt),
    };
  }

  private getReminderDecision({
    settings,
    sentDateKey,
    daysSinceSent,
  }: {
    settings: ReminderSettings;
    sentDateKey: string;
    daysSinceSent: number;
  }): ReminderDecision | null {
    /*
     * Check the second follow-up first.
     *
     * This gives us catch-up behavior after downtime:
     * an estimate first encountered after the second
     * threshold receives only the latest applicable
     * reminder rather than both emails at once.
     */
    if (
      settings.secondFollowUpEnabled &&
      daysSinceSent >= settings.secondFollowUpDays
    ) {
      return {
        type: EstimateReminderType.SECOND_FOLLOW_UP,

        scheduledFor: dateKeyToUtcDate(
          addDaysToDateKey(sentDateKey, settings.secondFollowUpDays),
        ),
      };
    }

    if (
      settings.firstFollowUpEnabled &&
      daysSinceSent >= settings.firstFollowUpDays
    ) {
      return {
        type: EstimateReminderType.FIRST_FOLLOW_UP,

        scheduledFor: dateKeyToUtcDate(
          addDaysToDateKey(sentDateKey, settings.firstFollowUpDays),
        ),
      };
    }

    return null;
  }

  private resolveSettings(settings: ReminderSettings | null): ReminderSettings {
    return settings ?? DEFAULT_SETTINGS;
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
                                estimate.currency,
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
      `Estimate total: ${formatMoney(estimate.totalCents, estimate.currency)}`,
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
  return formatCurrencyAmount(cents, currency, 'en-CA');
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
