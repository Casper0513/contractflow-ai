import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommunicationCategory, EstimateStatus } from '@contractflow/db';
import {
  db,
  fromPrisma8Timestamp,
  prisma8TextParam,
  prisma8TimestampParam,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';
import {
  createEstimatePdf,
  type EstimatePdfEstimate,
  type EstimatePdfOrganization,
} from '@contractflow/invoice-pdf';
import { randomBytes } from 'node:crypto';

import { OrganizationMembershipService } from '../auth/organization-membership.service';
import type { Environment } from '../config/environment';
import { CustomerCommunicationsService } from '../customer-communications/customer-communications.service';
import { EstimatesService } from './estimates.service';
import { formatMoney as formatCurrencyAmount } from '../common/money/money';

@Injectable()
export class EstimateDeliveryService {
  constructor(
    private readonly configService: ConfigService<Environment, true>,
    private readonly customerCommunicationsService: CustomerCommunicationsService,
    private readonly estimatesService: EstimatesService,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async sendForUser(
    clerkUserId: string,
    estimateId: string,
    input: {
      subject?: string;
      message?: string;
    } = {},
    activeOrganizationId?: string,
  ) {
    const membership = await this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );

    const estimateRecord = await db.orm.public.Estimate.where({
      id: estimateId,
      organizationId: membership.organizationId,
    })
      .select(
        'id',
        'organizationId',
        'customerId',
        'jobId',
        'number',
        'status',
        'title',
        'notes',
        'terms',
        'validUntil',
        'currency',
        'subtotalCents',
        'discountCents',
        'taxRate',
        'taxCents',
        'totalCents',
        'updatedAt',
        'publicAccessToken',
      )
      .first();

    if (!estimateRecord) {
      throw new NotFoundException('Estimate not found');
    }

    const customer = await db.orm.public.Customer.where({
      id: estimateRecord.customerId,
    })
      .select('firstName', 'lastName', 'companyName', 'email', 'phone')
      .first();

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const job = estimateRecord.jobId
      ? await db.orm.public.Job.where({
          id: estimateRecord.jobId,
        })
          .select('name')
          .first()
      : null;

    const organization = await db.orm.public.Organization.where({
      id: estimateRecord.organizationId,
    })
      .select(
        'name',
        'legalName',
        'email',
        'phone',
        'addressLine1',
        'addressLine2',
        'city',
        'province',
        'postalCode',
        'country',
        'taxNumber',
        'website',
        'currency',
      )
      .first();

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const lineItemRecords = await db.orm.public.EstimateLineItem.where({
      estimateId: estimateRecord.id,
    })
      .select(
        'description',
        'quantity',
        'unitPriceCents',
        'lineTotalCents',
        'position',
      )
      .orderBy((model) => model.position.asc())
      .all();

    const estimate = {
      ...estimateRecord,

      validUntil:
        estimateRecord.validUntil === null
          ? null
          : fromPrisma8Timestamp(estimateRecord.validUntil),

      updatedAt: fromPrisma8Timestamp(estimateRecord.updatedAt),

      taxRate: estimateRecord.taxRate.toString(),

      customer,

      job,

      organization,

      lineItems: lineItemRecords.map((lineItem) => ({
        description: lineItem.description,

        quantity: lineItem.quantity.toString(),

        unitPriceCents: lineItem.unitPriceCents,

        lineTotalCents: lineItem.lineTotalCents,
      })),
    };

    if (estimate.status !== EstimateStatus.DRAFT) {
      throw new BadRequestException('Only draft estimates can be sent');
    }

    if (estimate.validUntil && estimate.validUntil < new Date()) {
      throw new BadRequestException(
        'This estimate has passed its validity date. Review the estimate and set an appropriate validity date before sending.',
      );
    }

    const customerEmail = estimate.customer.email?.trim();

    if (!customerEmail) {
      throw new BadRequestException(
        'Customer must have an email address before the estimate can be sent',
      );
    }

    const publicAccess = await this.ensurePublicAccess(
      membership.organizationId,
      estimate.id,
    );

    const webUrl = this.configService.get('WEB_URL', {
      infer: true,
    });

    const publicEstimateUrl = new URL(
      `/e/${publicAccess.token}`,
      webUrl,
    ).toString();

    const businessName =
      estimate.organization.legalName || estimate.organization.name;

    const customerName = getCustomerName(estimate.customer);

    const pdfEstimate: EstimatePdfEstimate = {
      number: estimate.number,

      status: EstimateStatus.SENT,

      title: estimate.title,

      currency: estimate.currency,

      validUntil: estimate.validUntil,

      subtotalCents: estimate.subtotalCents,

      discountCents: estimate.discountCents,

      taxRate: estimate.taxRate,

      taxCents: estimate.taxCents,

      totalCents: estimate.totalCents,

      notes: estimate.notes,

      terms: estimate.terms,

      customer: {
        firstName: estimate.customer.firstName,

        lastName: estimate.customer.lastName,

        companyName: estimate.customer.companyName,

        email: estimate.customer.email,

        phone: estimate.customer.phone,
      },

      job: estimate.job
        ? {
            name: estimate.job.name,
          }
        : null,

      lineItems: estimate.lineItems.map((lineItem) => ({
        description: lineItem.description,

        quantity: lineItem.quantity,

        unitPriceCents: lineItem.unitPriceCents,

        lineTotalCents: lineItem.lineTotalCents,
      })),
    };

    const pdfOrganization: EstimatePdfOrganization = {
      name: estimate.organization.name,

      legalName: estimate.organization.legalName,

      email: estimate.organization.email,

      phone: estimate.organization.phone,

      addressLine1: estimate.organization.addressLine1,

      addressLine2: estimate.organization.addressLine2,

      city: estimate.organization.city,

      province: estimate.organization.province,

      postalCode: estimate.organization.postalCode,

      country: estimate.organization.country,

      taxNumber: estimate.organization.taxNumber,

      website: estimate.organization.website,
    };

    const pdf = await createEstimatePdf(pdfEstimate, pdfOrganization);

    const reviewedSubject = input.subject?.trim();

    const reviewedMessage = input.message?.trim();

    const emailSubject =
      reviewedSubject ||
      `Estimate ${estimate.number} from ${estimate.organization.name}`;

    const emailHtml = buildEstimateEmailHtml({
      number: estimate.number,

      title: estimate.title,

      totalCents: estimate.totalCents,

      currency: estimate.currency,

      validUntil: estimate.validUntil,

      businessName,

      customerName,

      publicEstimateUrl,

      customMessage: reviewedMessage,
    });

    const emailText = buildEstimateEmailText({
      number: estimate.number,

      title: estimate.title,

      totalCents: estimate.totalCents,

      currency: estimate.currency,

      validUntil: estimate.validUntil,

      businessName,

      customerName,

      publicEstimateUrl,

      customMessage: reviewedMessage,
    });

    try {
      await this.customerCommunicationsService.sendEmail({
        organizationId: membership.organizationId,

        customerId: estimate.customerId,

        actorUserId: membership.userId,

        category: CommunicationCategory.ESTIMATE,

        recipientEmail: customerEmail,

        subject: emailSubject,

        htmlBody: emailHtml,

        textBody: emailText,

        estimateId: estimate.id,

        jobId: estimate.jobId,

        attachments: [
          {
            filename: sanitizePdfFilename(`${estimate.number}.pdf`),

            content: pdf,
          },
        ],

        replyTo: estimate.organization.email ?? undefined,

        idempotencyKey: `estimate-send/${estimate.id}/${estimate.updatedAt.toISOString()}`,
      });
    } catch (error) {
      if (publicAccess.created) {
        await this.clearPublicAccess(
          membership.organizationId,
          estimate.id,
          publicAccess.token,
        );
      }

      throw error;
    }

    await db.transaction(async (tx) => {
      const now = toPrisma8Timestamp();

      const plan = db.raw.sql`
            UPDATE "Estimate"
            SET
              "status" = 'SENT',
              "sentAt" = ${prisma8TimestampParam(now)},
              "updatedAt" = ${prisma8TimestampParam(now)}
            WHERE
              "id" = ${prisma8TextParam(estimate.id)}
              AND "organizationId" = ${prisma8TextParam(membership.organizationId)}
              AND "status" = 'DRAFT'
          `
        .affectedCount()
        .build();

      const result = await tx.execute(plan);

      if (result.affectedRows !== 1) {
        throw new BadRequestException('Estimate could not be marked as sent');
      }

      await tx.orm.public.CustomerActivity.create({
        organizationId: membership.organizationId,

        customerId: estimate.customerId,

        actorUserId: membership.userId,

        _type: 'ESTIMATE_SENT',

        title: 'Estimate sent',

        description: `${estimate.number} was sent to the customer.`,

        metadata: {
          estimateId: estimate.id,

          estimateNumber: estimate.number,

          totalCents: estimate.totalCents,

          source: 'estimate_email',
        },

        createdAt: now,
      });
    });

    return this.estimatesService.getByIdForUser(
      clerkUserId,
      estimate.id,
      activeOrganizationId,
    );
  }

  private async ensurePublicAccess(
    organizationId: string,
    estimateId: string,
  ): Promise<{
    token: string;
    created: boolean;
  }> {
    const existing = await db.orm.public.Estimate.where({
      id: estimateId,

      organizationId,
    })
      .select('publicAccessToken')
      .first();

    if (!existing) {
      throw new NotFoundException('Estimate not found');
    }

    if (existing.publicAccessToken) {
      return {
        token: existing.publicAccessToken,

        created: false,
      };
    }

    const token = randomBytes(32).toString('base64url');

    const now = toPrisma8Timestamp();

    const plan = db.raw.sql`
        UPDATE "Estimate"
        SET
          "publicAccessToken" = ${prisma8TextParam(token)},
          "publicAccessCreatedAt" = ${prisma8TimestampParam(now)},
          "updatedAt" = ${prisma8TimestampParam(now)}
        WHERE
          "id" = ${prisma8TextParam(estimateId)}
          AND "organizationId" = ${prisma8TextParam(organizationId)}
          AND "status" = 'DRAFT'
          AND "publicAccessToken" IS NULL
      `
      .affectedCount()
      .build();

    const result = await db.transaction(async (tx) => tx.execute(plan));

    if (result.affectedRows === 1) {
      return {
        token,

        created: true,
      };
    }

    const current = await db.orm.public.Estimate.where({
      id: estimateId,

      organizationId,
    })
      .select('publicAccessToken')
      .first();

    if (!current?.publicAccessToken) {
      throw new BadRequestException('Unable to create public estimate access');
    }

    return {
      token: current.publicAccessToken,

      created: false,
    };
  }

  private async clearPublicAccess(
    organizationId: string,
    estimateId: string,
    token: string,
  ) {
    const now = toPrisma8Timestamp();

    const plan = db.raw.sql`
        UPDATE "Estimate"
        SET
          "publicAccessToken" = NULL,
          "publicAccessCreatedAt" = NULL,
          "updatedAt" = ${prisma8TimestampParam(now)}
        WHERE
          "id" = ${prisma8TextParam(estimateId)}
          AND "organizationId" = ${prisma8TextParam(organizationId)}
          AND "status" = 'DRAFT'
          AND "publicAccessToken" = ${prisma8TextParam(token)}
      `
      .affectedCount()
      .build();

    await db.transaction(async (tx) => {
      await tx.execute(plan);
    });
  }
}

function getCustomerName(customer: {
  firstName: string;
  lastName: string | null;
  companyName: string | null;
}) {
  const name = [customer.firstName, customer.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return name || customer.companyName || 'there';
}

function buildEstimateEmailHtml({
  number,
  title,
  totalCents,
  currency,
  validUntil,
  businessName,
  customerName,
  publicEstimateUrl,
  customMessage,
}: {
  number: string;
  title: string | null;
  totalCents: number;
  currency: string;
  validUntil: Date | null;
  businessName: string;
  customerName: string;
  publicEstimateUrl: string;
  customMessage?: string;
}) {
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
                      Estimate ${escapeHtml(number)}
                    </h1>

                    <p style="margin:24px 0 0;line-height:1.6;color:#52525b;">
                      Hi ${escapeHtml(customerName)},
                    </p>

                    ${
                      customMessage
                        ? `
                          <p style="margin:12px 0 0;line-height:1.6;color:#52525b;white-space:pre-line;">
                            ${escapeHtml(customMessage)}
                          </p>
                        `
                        : `
                          <p style="margin:12px 0 0;line-height:1.6;color:#52525b;">
                            We have prepared an estimate for you. You can review the details and approve or decline it online.
                          </p>
                        `
                    }

                    ${
                      title
                        ? `
                          <p style="margin:20px 0 0;font-weight:700;">
                            ${escapeHtml(title)}
                          </p>
                        `
                        : ''
                    }

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border-collapse:collapse;">
                      <tr>
                        <td style="padding:10px 0;color:#71717a;">
                          Estimate total
                        </td>

                        <td align="right" style="padding:10px 0;font-weight:700;">
                          ${escapeHtml(formatMoney(totalCents, currency))}
                        </td>
                      </tr>

                      ${
                        validUntil
                          ? `
                            <tr>
                              <td style="padding:10px 0;color:#71717a;border-top:1px solid #e4e4e7;">
                                Valid until
                              </td>

                              <td align="right" style="padding:10px 0;font-weight:700;border-top:1px solid #e4e4e7;">
                                ${escapeHtml(formatDate(validUntil))}
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
                      A PDF copy of this estimate is attached for your records.
                    </p>

                    <p style="margin:12px 0 0;line-height:1.6;color:#71717a;font-size:13px;">
                      If you have questions about this estimate, reply directly to this email.
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

function buildEstimateEmailText({
  number,
  title,
  totalCents,
  currency,
  validUntil,
  businessName,
  customerName,
  publicEstimateUrl,
  customMessage,
}: {
  number: string;
  title: string | null;
  totalCents: number;
  currency: string;
  validUntil: Date | null;
  businessName: string;
  customerName: string;
  publicEstimateUrl: string;
  customMessage?: string;
}) {
  return [
    businessName,
    '',
    `Estimate ${number}`,
    '',
    `Hi ${customerName},`,
    '',
    customMessage ||
      'We have prepared an estimate for you. You can review the details and approve or decline it online.',
    ...(title ? ['', `Title: ${title}`] : []),
    '',
    `Estimate total: ${formatMoney(totalCents, currency)}`,
    ...(validUntil ? [`Valid until: ${formatDate(validUntil)}`] : []),
    '',
    `Review estimate: ${publicEstimateUrl}`,
    '',
    'A PDF copy of this estimate is attached for your records.',
    '',
    'If you have questions about this estimate, reply directly to this email.',
  ].join('\n');
}

function formatMoney(cents: number, currency: string) {
  return formatCurrencyAmount(cents, currency, 'en-CA');
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function sanitizePdfFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
