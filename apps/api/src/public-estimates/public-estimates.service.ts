import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerActivityType,
  EstimateStatus,
  Prisma,
  prisma,
} from '@contractflow/db';
import {
  createEstimatePdf,
  type EstimatePdfEstimate,
  type EstimatePdfOrganization,
} from '@contractflow/invoice-pdf';

import { ActivityService } from '../activity/activity.service';

type PublicEstimateDecisionStatus =
  typeof EstimateStatus.APPROVED | typeof EstimateStatus.DECLINED;

type PublicEstimateDecisionActivityType =
  | typeof CustomerActivityType.ESTIMATE_APPROVED
  | typeof CustomerActivityType.ESTIMATE_DECLINED;

@Injectable()
export class PublicEstimatesService {
  constructor(private readonly activityService: ActivityService) {}

  async getByToken(token: string) {
    const normalizedToken = token.trim();

    this.validateToken(normalizedToken);

    return prisma.$transaction(async (tx) => {
      const existing = await tx.estimate.findUnique({
        where: {
          publicAccessToken: normalizedToken,
        },

        select: {
          id: true,
          organizationId: true,
          customerId: true,
          number: true,
          status: true,
        },
      });

      if (!existing || existing.status === EstimateStatus.DRAFT) {
        throw new NotFoundException('Estimate not found');
      }

      if (existing.status === EstimateStatus.SENT) {
        const now = new Date();

        const result = await tx.estimate.updateMany({
          where: {
            id: existing.id,
            organizationId: existing.organizationId,
            status: EstimateStatus.SENT,
            publicAccessToken: normalizedToken,
          },

          data: {
            status: EstimateStatus.VIEWED,
            viewedAt: now,
          },
        });

        if (result.count === 1) {
          await this.activityService.recordCustomerActivity(
            {
              organizationId: existing.organizationId,
              customerId: existing.customerId,
              actorUserId: null,

              type: CustomerActivityType.ESTIMATE_VIEWED,

              title: 'Estimate viewed',

              description: `${existing.number} was viewed by the customer.`,

              metadata: {
                estimateId: existing.id,
                estimateNumber: existing.number,
                previousStatus: EstimateStatus.SENT,
                status: EstimateStatus.VIEWED,
                source: 'public_estimate_portal',
              },
            },

            tx,
          );
        }
      }

      const estimate = await tx.estimate.findUnique({
        where: {
          id: existing.id,
        },

        select: this.publicEstimateSelect(),
      });

      if (!estimate) {
        throw new NotFoundException('Estimate not found');
      }

      return estimate;
    });
  }

  async getPdfByToken(token: string) {
    /*
     * Reusing getByToken() keeps PDF access consistent with the
     * public estimate portal. Opening the PDF directly also counts
     * as viewing a SENT estimate.
     */
    const estimate = await this.getByToken(token);

    const pdfEstimate: EstimatePdfEstimate = {
      number: estimate.number,

      status: estimate.status,

      title: estimate.title,

      currency: estimate.currency,

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

    const buffer = await createEstimatePdf(pdfEstimate, pdfOrganization);

    return {
      buffer,

      filename: sanitizePdfFilename(`${estimate.number}.pdf`),
    };
  }

  async approveByToken(token: string) {
    return this.transitionByToken(
      token,
      EstimateStatus.APPROVED,
      CustomerActivityType.ESTIMATE_APPROVED,
      'Estimate approved',
      'was approved by the customer.',
    );
  }

  async declineByToken(token: string) {
    return this.transitionByToken(
      token,
      EstimateStatus.DECLINED,
      CustomerActivityType.ESTIMATE_DECLINED,
      'Estimate declined',
      'was declined by the customer.',
    );
  }

  private async transitionByToken(
    token: string,
    nextStatus: PublicEstimateDecisionStatus,
    activityType: PublicEstimateDecisionActivityType,
    activityTitle: string,
    activityDescription: string,
  ) {
    const normalizedToken = token.trim();

    this.validateToken(normalizedToken);

    return prisma.$transaction(async (tx) => {
      const existing = await tx.estimate.findUnique({
        where: {
          publicAccessToken: normalizedToken,
        },

        select: {
          id: true,
          organizationId: true,
          customerId: true,
          number: true,
          status: true,
          viewedAt: true,
        },
      });

      if (!existing || existing.status === EstimateStatus.DRAFT) {
        throw new NotFoundException('Estimate not found');
      }

      if (existing.status === nextStatus) {
        const estimate = await tx.estimate.findUnique({
          where: {
            id: existing.id,
          },

          select: this.publicEstimateSelect(),
        });

        if (!estimate) {
          throw new NotFoundException('Estimate not found');
        }

        return estimate;
      }

      if (
        existing.status !== EstimateStatus.SENT &&
        existing.status !== EstimateStatus.VIEWED
      ) {
        throw new BadRequestException(
          `Estimate cannot transition from ${existing.status} to ${nextStatus}`,
        );
      }

      const now = new Date();

      const updateData =
        nextStatus === EstimateStatus.APPROVED
          ? {
              status: EstimateStatus.APPROVED,
              approvedAt: now,
              viewedAt: existing.viewedAt ?? now,
            }
          : {
              status: EstimateStatus.DECLINED,
              declinedAt: now,
              viewedAt: existing.viewedAt ?? now,
            };

      const result = await tx.estimate.updateMany({
        where: {
          id: existing.id,
          organizationId: existing.organizationId,

          status: {
            in: [EstimateStatus.SENT, EstimateStatus.VIEWED],
          },

          publicAccessToken: normalizedToken,
        },

        data: updateData,
      });

      if (result.count !== 1) {
        throw new BadRequestException(
          'Estimate status changed before the request could be completed',
        );
      }

      await this.activityService.recordCustomerActivity(
        {
          organizationId: existing.organizationId,
          customerId: existing.customerId,
          actorUserId: null,

          type: activityType,

          title: activityTitle,

          description: `${existing.number} ${activityDescription}`,

          metadata: {
            estimateId: existing.id,
            estimateNumber: existing.number,
            previousStatus: existing.status,
            status: nextStatus,
            source: 'public_estimate_portal',
          },
        },

        tx,
      );

      const estimate = await tx.estimate.findUnique({
        where: {
          id: existing.id,
        },

        select: this.publicEstimateSelect(),
      });

      if (!estimate) {
        throw new NotFoundException('Estimate not found');
      }

      return estimate;
    });
  }

  private validateToken(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new BadRequestException('Invalid estimate access token');
    }
  }

  private publicEstimateSelect(): Prisma.EstimateSelect {
    return {
      number: true,
      status: true,
      title: true,

      notes: true,
      terms: true,

      validUntil: true,

      currency: true,

      subtotalCents: true,
      discountCents: true,

      taxRate: true,
      taxCents: true,
      totalCents: true,

      sentAt: true,
      viewedAt: true,
      approvedAt: true,
      declinedAt: true,
      expiredAt: true,

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
          logoUrl: true,
          timezone: true,
          currency: true,
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
          position: true,
        },
      },
    };
  }
}

function sanitizePdfFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}
