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
  createInvoicePdf,
  type InvoicePdfInvoice,
  type InvoicePdfOrganization,
} from '@contractflow/invoice-pdf';

@Injectable()
export class PublicInvoicesService {
  async getByToken(token: string) {
    const normalizedToken = token.trim();

    this.validateToken(normalizedToken);

    return db.transaction(async (tx) => {
      const existing = await tx.orm.public.Invoice.where({
        publicAccessToken: normalizedToken,
      })
        .select('id', 'organizationId', 'customerId', 'number', 'status')
        .first();

      if (!existing) {
        throw new NotFoundException('Invoice not found');
      }

      if (existing.status === 'DRAFT') {
        throw new NotFoundException('Invoice not found');
      }

      if (existing.status === 'SENT') {
        const now = toPrisma8Timestamp();

        const nowParam = prisma8TimestampParam(now);

        /*
         * Keep the status transition atomic.
         *
         * Only one concurrent request can successfully
         * change SENT -> VIEWED because SENT remains
         * part of the UPDATE predicate.
         */
        const plan = db.raw.sql`
          UPDATE "Invoice"
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

        /*
         * Only the request that actually performed the
         * SENT -> VIEWED transition records the activity.
         *
         * The activity write is in the same Prisma 8
         * transaction as the status transition.
         */
        if (result.affectedRows === 1) {
          await tx.orm.public.CustomerActivity.create({
            organizationId: existing.organizationId,

            customerId: existing.customerId,

            actorUserId: null,

            _type: 'INVOICE_VIEWED',

            title: 'Invoice viewed',

            description: `${existing.number} was viewed by the customer.`,

            metadata: {
              invoiceId: existing.id,

              invoiceNumber: existing.number,

              previousStatus: 'SENT',

              status: 'VIEWED',

              source: 'public_invoice_portal',
            },
          });
        }
      }

      const invoice = await this.getPublicInvoice(tx, existing.id);

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      return invoice;
    });
  }

  async getPdfByToken(token: string) {
    /*
     * Reusing getByToken() means a customer who goes
     * directly to the PDF URL also counts as having
     * viewed the invoice.
     */
    const invoice = await this.getByToken(token);

    const pdfInvoice: InvoicePdfInvoice = {
      number: invoice.number,

      status: invoice.status,

      title: invoice.title,

      currency: invoice.currency,

      issueDate: invoice.issueDate,

      dueDate: invoice.dueDate,

      subtotalCents: invoice.subtotalCents,

      discountCents: invoice.discountCents,

      taxRate: invoice.taxRate.toString(),

      taxCents: invoice.taxCents,

      totalCents: invoice.totalCents,

      amountPaidCents: invoice.amountPaidCents,

      balanceDueCents: invoice.balanceDueCents,

      notes: invoice.notes,

      terms: invoice.terms,

      customer: {
        firstName: invoice.customer.firstName,

        lastName: invoice.customer.lastName,

        companyName: invoice.customer.companyName,

        email: invoice.customer.email,

        phone: invoice.customer.phone,
      },

      job: invoice.job
        ? {
            name: invoice.job.name,
          }
        : null,

      sourceEstimate: invoice.sourceEstimate
        ? {
            number: invoice.sourceEstimate.number,
          }
        : null,

      lineItems: invoice.lineItems.map((lineItem) => ({
        description: lineItem.description,

        quantity: lineItem.quantity.toString(),

        unitPriceCents: lineItem.unitPriceCents,

        lineTotalCents: lineItem.lineTotalCents,
      })),

      payments: invoice.payments.map((payment) => ({
        status: 'RECORDED',

        method: payment.method,

        amountCents: payment.amountCents,

        reference: null,

        receivedAt: payment.receivedAt,
      })),
    };

    const pdfOrganization: InvoicePdfOrganization = {
      name: invoice.organization.name,

      legalName: invoice.organization.legalName,

      email: invoice.organization.email,

      phone: invoice.organization.phone,

      addressLine1: invoice.organization.addressLine1,

      addressLine2: invoice.organization.addressLine2,

      city: invoice.organization.city,

      province: invoice.organization.province,

      postalCode: invoice.organization.postalCode,

      country: invoice.organization.country,

      taxNumber: invoice.organization.taxNumber,

      website: invoice.organization.website,
    };

    const buffer = await createInvoicePdf(pdfInvoice, pdfOrganization);

    return {
      buffer,

      filename: sanitizePdfFilename(`${invoice.number}.pdf`),
    };
  }

  private validateToken(token: string) {
    /*
     * randomBytes(32).toString('base64url')
     * produces 43 URL-safe characters.
     */
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new BadRequestException('Invalid invoice access token');
    }
  }

  private async getPublicInvoice(tx: DatabaseTransaction, invoiceId: string) {
    const invoice = await tx.orm.public.Invoice.where({
      id: invoiceId,
    })
      .select(
        'id',
        'organizationId',
        'customerId',
        'jobId',
        'sourceEstimateId',

        'number',
        'status',
        'title',
        'notes',
        'terms',
        'currency',

        'issueDate',
        'dueDate',

        'subtotalCents',
        'discountCents',
        'taxRate',
        'taxCents',
        'totalCents',
        'amountPaidCents',
        'balanceDueCents',

        'sentAt',
        'viewedAt',
        'paidAt',
        'overdueAt',
        'voidedAt',
      )
      .first();

    if (!invoice) {
      return null;
    }

    const customer = await tx.orm.public.Customer.where({
      id: invoice.customerId,

      organizationId: invoice.organizationId,
    })
      .select('firstName', 'lastName', 'companyName', 'email', 'phone')
      .first();

    if (!customer) {
      throw new NotFoundException('Invoice not found');
    }

    const organization = await tx.orm.public.Organization.where({
      id: invoice.organizationId,
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
      throw new NotFoundException('Invoice not found');
    }

    const job =
      invoice.jobId === null
        ? null
        : await tx.orm.public.Job.where({
            id: invoice.jobId,

            organizationId: invoice.organizationId,
          })
            .select('name')
            .first();

    const sourceEstimate =
      invoice.sourceEstimateId === null
        ? null
        : await tx.orm.public.Estimate.where({
            id: invoice.sourceEstimateId,

            organizationId: invoice.organizationId,
          })
            .select('number')
            .first();

    const lineItems = await tx.orm.public.InvoiceLineItem.where({
      invoiceId: invoice.id,
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

    const payments = await tx.orm.public.Payment.where({
      invoiceId: invoice.id,

      status: 'RECORDED',
    })
      .select('method', 'amountCents', 'receivedAt')
      .orderBy((model) => model.receivedAt.desc())
      .all();

    return {
      number: invoice.number,

      status: invoice.status,

      title: invoice.title,

      notes: invoice.notes,

      terms: invoice.terms,

      currency: invoice.currency,

      issueDate: fromPrisma8Timestamp(invoice.issueDate),

      dueDate:
        invoice.dueDate === null ? null : fromPrisma8Timestamp(invoice.dueDate),

      subtotalCents: invoice.subtotalCents,

      discountCents: invoice.discountCents,

      taxRate: invoice.taxRate,

      taxCents: invoice.taxCents,

      totalCents: invoice.totalCents,

      amountPaidCents: invoice.amountPaidCents,

      balanceDueCents: invoice.balanceDueCents,

      sentAt:
        invoice.sentAt === null ? null : fromPrisma8Timestamp(invoice.sentAt),

      viewedAt:
        invoice.viewedAt === null
          ? null
          : fromPrisma8Timestamp(invoice.viewedAt),

      paidAt:
        invoice.paidAt === null ? null : fromPrisma8Timestamp(invoice.paidAt),

      overdueAt:
        invoice.overdueAt === null
          ? null
          : fromPrisma8Timestamp(invoice.overdueAt),

      voidedAt:
        invoice.voidedAt === null
          ? null
          : fromPrisma8Timestamp(invoice.voidedAt),

      customer,

      job,

      sourceEstimate,

      organization,

      lineItems,

      payments: payments.map((payment) => ({
        method: payment.method,

        amountCents: payment.amountCents,

        receivedAt: fromPrisma8Timestamp(payment.receivedAt),
      })),
    };
  }
}

function sanitizePdfFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}
