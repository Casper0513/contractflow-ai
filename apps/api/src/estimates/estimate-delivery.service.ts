import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomerActivityType, EstimateStatus, prisma } from '@contractflow/db';
import {
  createEstimatePdf,
  type EstimatePdfEstimate,
  type EstimatePdfOrganization,
} from '@contractflow/invoice-pdf';
import { randomBytes } from 'node:crypto';

import { ActivityService } from '../activity/activity.service';
import type { Environment } from '../config/environment';
import { EmailService } from '../email/email.service';
import { EstimatesService } from './estimates.service';

@Injectable()
export class EstimateDeliveryService {
  constructor(
    private readonly activityService: ActivityService,
    private readonly configService: ConfigService<Environment, true>,
    private readonly emailService: EmailService,
    private readonly estimatesService: EstimatesService,
  ) {}

  async sendForUser(clerkUserId: string, estimateId: string) {
    const membership = await prisma.membership.findFirst({
      where: {
        user: {
          clerkUserId,
        },
      },

      orderBy: {
        createdAt: 'asc',
      },

      select: {
        organizationId: true,
        userId: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('No organization membership found');
    }

    const estimate = await prisma.estimate.findFirst({
      where: {
        id: estimateId,
        organizationId: membership.organizationId,
      },

      select: {
        id: true,
        organizationId: true,
        customerId: true,

        number: true,
        status: true,
        title: true,

        notes: true,
        terms: true,

        validUntil: true,

        subtotalCents: true,
        discountCents: true,
        taxRate: true,
        taxCents: true,
        totalCents: true,

        updatedAt: true,

        publicAccessToken: true,

        customer: {
          select: {
            firstName: true,
            lastName: true,
            companyName: true,
            email: true,
            phone: true,
          },
        },

        job: {
          select: {
            name: true,
          },
        },

        lineItems: {
          orderBy: {
            position: 'asc',
          },

          select: {
            description: true,
            quantity: true,
            unitPriceCents: true,
            lineTotalCents: true,
          },
        },

        organization: {
          select: {
            name: true,
            legalName: true,

            email: true,
            phone: true,

            addressLine1: true,
            addressLine2: true,
            city: true,
            province: true,
            postalCode: true,
            country: true,

            taxNumber: true,
            website: true,

            currency: true,
          },
        },
      },
    });

    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }

    if (estimate.status !== EstimateStatus.DRAFT) {
      throw new BadRequestException('Only draft estimates can be sent');
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

      currency: estimate.organization.currency,

      validUntil: estimate.validUntil,

      subtotalCents: estimate.subtotalCents,
      discountCents: estimate.discountCents,

      taxRate: estimate.taxRate.toString(),

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

        quantity: lineItem.quantity.toString(),

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

    try {
      await this.emailService.send({
        to: customerEmail,

        subject: `Estimate ${estimate.number} from ${estimate.organization.name}`,

        html: buildEstimateEmailHtml({
          number: estimate.number,
          title: estimate.title,
          totalCents: estimate.totalCents,
          currency: estimate.organization.currency,
          validUntil: estimate.validUntil,
          businessName,
          customerName,
          publicEstimateUrl,
        }),

        text: buildEstimateEmailText({
          number: estimate.number,
          title: estimate.title,
          totalCents: estimate.totalCents,
          currency: estimate.organization.currency,
          validUntil: estimate.validUntil,
          businessName,
          customerName,
          publicEstimateUrl,
        }),

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
        await prisma.estimate.updateMany({
          where: {
            id: estimate.id,
            organizationId: membership.organizationId,
            status: EstimateStatus.DRAFT,
            publicAccessToken: publicAccess.token,
          },

          data: {
            publicAccessToken: null,
            publicAccessCreatedAt: null,
          },
        });
      }

      throw error;
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const result = await tx.estimate.updateMany({
        where: {
          id: estimate.id,
          organizationId: membership.organizationId,
          status: EstimateStatus.DRAFT,
        },

        data: {
          status: EstimateStatus.SENT,
          sentAt: now,
        },
      });

      if (result.count !== 1) {
        throw new BadRequestException('Estimate could not be marked as sent');
      }

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,

          customerId: estimate.customerId,

          actorUserId: membership.userId,

          type: CustomerActivityType.ESTIMATE_SENT,

          title: 'Estimate sent',

          description: `${estimate.number} was sent to the customer.`,

          metadata: {
            estimateId: estimate.id,

            estimateNumber: estimate.number,

            totalCents: estimate.totalCents,

            source: 'estimate_email',
          },
        },

        tx,
      );
    });

    return this.estimatesService.getByIdForUser(clerkUserId, estimate.id);
  }

  private async ensurePublicAccess(
    organizationId: string,
    estimateId: string,
  ): Promise<{
    token: string;
    created: boolean;
  }> {
    const existing = await prisma.estimate.findFirst({
      where: {
        id: estimateId,
        organizationId,
      },

      select: {
        publicAccessToken: true,
      },
    });

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

    const now = new Date();

    const result = await prisma.estimate.updateMany({
      where: {
        id: estimateId,
        organizationId,
        status: EstimateStatus.DRAFT,
        publicAccessToken: null,
      },

      data: {
        publicAccessToken: token,
        publicAccessCreatedAt: now,
      },
    });

    if (result.count === 1) {
      return {
        token,
        created: true,
      };
    }

    const current = await prisma.estimate.findFirst({
      where: {
        id: estimateId,
        organizationId,
      },

      select: {
        publicAccessToken: true,
      },
    });

    if (!current?.publicAccessToken) {
      throw new BadRequestException('Unable to create public estimate access');
    }

    return {
      token: current.publicAccessToken,
      created: false,
    };
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
}: {
  number: string;
  title: string | null;
  totalCents: number;
  currency: string;
  validUntil: Date | null;
  businessName: string;
  customerName: string;
  publicEstimateUrl: string;
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

                    <p style="margin:12px 0 0;line-height:1.6;color:#52525b;">
                      We have prepared an estimate for you. You can review the details and approve or decline it online.
                    </p>

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
}: {
  number: string;
  title: string | null;
  totalCents: number;
  currency: string;
  validUntil: Date | null;
  businessName: string;
  customerName: string;
  publicEstimateUrl: string;
}) {
  return [
    businessName,
    '',
    `Estimate ${number}`,
    '',
    `Hi ${customerName},`,
    '',
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
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
  }).format(cents / 100);
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
