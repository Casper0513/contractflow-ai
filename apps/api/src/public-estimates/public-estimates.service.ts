import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type DatabaseTransaction,
  db,
  fromPrisma8Timestamp,
  prisma8TimestampParam,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';
import {
  createEstimatePdf,
  type EstimatePdfEstimate,
  type EstimatePdfOrganization,
} from '@contractflow/invoice-pdf';

type PublicEstimateDecisionStatus = 'APPROVED' | 'DECLINED';

type PublicEstimateDecisionActivityType =
  'ESTIMATE_APPROVED' | 'ESTIMATE_DECLINED';

@Injectable()
export class PublicEstimatesService {
  async getByToken(token: string) {
    const normalizedToken = token.trim();

    this.validateToken(normalizedToken);

    return db.transaction(async (tx) => {
      const existing = await tx.orm.public.Estimate.where({
        publicAccessToken: normalizedToken,
      })
        .select('id', 'organizationId', 'customerId', 'number', 'status')
        .first();

      if (!existing || existing.status === 'DRAFT') {
        throw new NotFoundException('Estimate not found');
      }

      if (existing.status === 'SENT') {
        const now = toPrisma8Timestamp();

        const nowParam = prisma8TimestampParam(now);

        const plan = db.raw.sql`
          UPDATE "Estimate"
          SET
            "status" = 'VIEWED',
            "viewedAt" = ${nowParam},
            "updatedAt" = ${nowParam}
          WHERE
            "id" = ${existing.id}
            AND "organizationId" = ${existing.organizationId}
            AND "status" = 'SENT'
            AND "publicAccessToken" = ${normalizedToken}
        `
          .affectedCount()
          .build();

        const result = await tx.execute(plan);

        if (result.affectedRows === 1) {
          await tx.orm.public.CustomerActivity.create({
            organizationId: existing.organizationId,

            customerId: existing.customerId,

            actorUserId: null,

            _type: 'ESTIMATE_VIEWED',

            title: 'Estimate viewed',

            description: `${existing.number} was viewed by the customer.`,

            metadata: {
              estimateId: existing.id,

              estimateNumber: existing.number,

              previousStatus: 'SENT',

              status: 'VIEWED',

              source: 'public_estimate_portal',
            },
          });
        }
      }

      const estimate = await this.getPublicEstimate(tx, existing.id);

      if (!estimate) {
        throw new NotFoundException('Estimate not found');
      }

      return estimate;
    });
  }

  async getPdfByToken(token: string) {
    /*
     * Reusing getByToken() keeps PDF access consistent
     * with the public estimate portal. Opening the PDF
     * directly also counts as viewing a SENT estimate.
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
      'APPROVED',
      'ESTIMATE_APPROVED',
      'Estimate approved',
      'was approved by the customer.',
    );
  }

  async declineByToken(token: string) {
    return this.transitionByToken(
      token,
      'DECLINED',
      'ESTIMATE_DECLINED',
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

    return db.transaction(async (tx) => {
      const existing = await tx.orm.public.Estimate.where({
        publicAccessToken: normalizedToken,
      })
        .select(
          'id',
          'organizationId',
          'customerId',
          'number',
          'status',
          'viewedAt',
        )
        .first();

      if (!existing || existing.status === 'DRAFT') {
        throw new NotFoundException('Estimate not found');
      }

      if (existing.status === nextStatus) {
        const estimate = await this.getPublicEstimate(tx, existing.id);

        if (!estimate) {
          throw new NotFoundException('Estimate not found');
        }

        return estimate;
      }

      if (existing.status !== 'SENT' && existing.status !== 'VIEWED') {
        throw new BadRequestException(
          `Estimate cannot transition from ${existing.status} to ${nextStatus}`,
        );
      }

      const now = toPrisma8Timestamp();

      const nowParam = prisma8TimestampParam(now);

      const plan =
        nextStatus === 'APPROVED'
          ? db.raw.sql`
              UPDATE "Estimate"
              SET
                "status" = 'APPROVED',
                "approvedAt" = ${nowParam},
                "viewedAt" = COALESCE(
                  "viewedAt",
                  ${nowParam}
                ),
                "updatedAt" = ${nowParam}
              WHERE
                "id" = ${existing.id}
                AND "organizationId" = ${existing.organizationId}
                AND "status" IN ('SENT', 'VIEWED')
                AND "publicAccessToken" = ${normalizedToken}
            `
              .affectedCount()
              .build()
          : db.raw.sql`
              UPDATE "Estimate"
              SET
                "status" = 'DECLINED',
                "declinedAt" = ${nowParam},
                "viewedAt" = COALESCE(
                  "viewedAt",
                  ${nowParam}
                ),
                "updatedAt" = ${nowParam}
              WHERE
                "id" = ${existing.id}
                AND "organizationId" = ${existing.organizationId}
                AND "status" IN ('SENT', 'VIEWED')
                AND "publicAccessToken" = ${normalizedToken}
            `
              .affectedCount()
              .build();

      const result = await tx.execute(plan);

      if (result.affectedRows !== 1) {
        throw new BadRequestException(
          'Estimate status changed before the request could be completed',
        );
      }

      await tx.orm.public.CustomerActivity.create({
        organizationId: existing.organizationId,

        customerId: existing.customerId,

        actorUserId: null,

        _type: activityType,

        title: activityTitle,

        description: `${existing.number} ${activityDescription}`,

        metadata: {
          estimateId: existing.id,

          estimateNumber: existing.number,

          previousStatus: existing.status,

          status: nextStatus,

          source: 'public_estimate_portal',
        },
      });

      const estimate = await this.getPublicEstimate(tx, existing.id);

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

  private async getPublicEstimate(tx: DatabaseTransaction, estimateId: string) {
    const estimate = await tx.orm.public.Estimate.where({
      id: estimateId,
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

        'sentAt',
        'viewedAt',
        'approvedAt',
        'declinedAt',
        'expiredAt',
      )
      .first();

    if (!estimate) {
      return null;
    }

    const customer = await tx.orm.public.Customer.where({
      id: estimate.customerId,

      organizationId: estimate.organizationId,
    })
      .select('firstName', 'lastName', 'companyName', 'email', 'phone')
      .first();

    if (!customer) {
      throw new NotFoundException('Estimate not found');
    }

    const organization = await tx.orm.public.Organization.where({
      id: estimate.organizationId,
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
        'logoUrl',
        'timezone',
        'currency',
      )
      .first();

    if (!organization) {
      throw new NotFoundException('Estimate not found');
    }

    const job =
      estimate.jobId === null
        ? null
        : await tx.orm.public.Job.where({
            id: estimate.jobId,

            organizationId: estimate.organizationId,
          })
            .select('name')
            .first();

    const lineItems = await tx.orm.public.EstimateLineItem.where({
      estimateId: estimate.id,
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

    return {
      number: estimate.number,

      status: estimate.status,

      title: estimate.title,

      notes: estimate.notes,

      terms: estimate.terms,

      validUntil:
        estimate.validUntil === null
          ? null
          : fromPrisma8Timestamp(estimate.validUntil),

      currency: estimate.currency,

      subtotalCents: estimate.subtotalCents,

      discountCents: estimate.discountCents,

      taxRate: estimate.taxRate,

      taxCents: estimate.taxCents,

      totalCents: estimate.totalCents,

      sentAt:
        estimate.sentAt === null ? null : fromPrisma8Timestamp(estimate.sentAt),

      viewedAt:
        estimate.viewedAt === null
          ? null
          : fromPrisma8Timestamp(estimate.viewedAt),

      approvedAt:
        estimate.approvedAt === null
          ? null
          : fromPrisma8Timestamp(estimate.approvedAt),

      declinedAt:
        estimate.declinedAt === null
          ? null
          : fromPrisma8Timestamp(estimate.declinedAt),

      expiredAt:
        estimate.expiredAt === null
          ? null
          : fromPrisma8Timestamp(estimate.expiredAt),

      customer,

      job,

      organization,

      lineItems,
    };
  }
}

function sanitizePdfFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}
