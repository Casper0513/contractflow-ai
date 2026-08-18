import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerActivityType,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
  prisma,
} from '@contractflow/db';
import {
  createInvoicePdf,
  type InvoicePdfInvoice,
  type InvoicePdfOrganization,
} from '@contractflow/invoice-pdf';

import { ActivityService } from '../activity/activity.service';

@Injectable()
export class PublicInvoicesService {
  constructor(private readonly activityService: ActivityService) {}

  async getByToken(token: string) {
    const normalizedToken = token.trim();

    this.validateToken(normalizedToken);

    return prisma.$transaction(async (tx) => {
      const existing = await tx.invoice.findUnique({
        where: {
          publicAccessToken: normalizedToken,
        },

        select: {
          id: true,
          organizationId: true,
          customerId: true,

          number: true,
          status: true,

          publicAccessCreatedAt: true,
        },
      });

      if (!existing) {
        throw new NotFoundException('Invoice not found');
      }

      if (existing.status === InvoiceStatus.DRAFT) {
        throw new NotFoundException('Invoice not found');
      }

      if (existing.status === InvoiceStatus.SENT) {
        const now = new Date();

        const result = await tx.invoice.updateMany({
          where: {
            id: existing.id,
            organizationId: existing.organizationId,

            status: InvoiceStatus.SENT,

            publicAccessToken: normalizedToken,
          },

          data: {
            status: InvoiceStatus.VIEWED,

            viewedAt: now,
          },
        });

        /*
         * Only the first successful SENT -> VIEWED
         * transition creates an activity record.
         *
         * This protects us if two customer requests
         * arrive at nearly the same time.
         */
        if (result.count === 1) {
          await this.activityService.recordCustomerActivity(
            {
              organizationId: existing.organizationId,

              customerId: existing.customerId,

              actorUserId: null,

              type: CustomerActivityType.INVOICE_VIEWED,

              title: 'Invoice viewed',

              description: `${existing.number} was viewed by the customer.`,

              metadata: {
                invoiceId: existing.id,

                invoiceNumber: existing.number,

                previousStatus: InvoiceStatus.SENT,

                status: InvoiceStatus.VIEWED,

                source: 'public_invoice_portal',
              },
            },

            tx,
          );
        }
      }

      const invoice = await tx.invoice.findUnique({
        where: {
          id: existing.id,
        },

        select: this.publicInvoiceSelect(),
      });

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

  private publicInvoiceSelect(): Prisma.InvoiceSelect {
    return {
      number: true,

      status: true,

      title: true,

      notes: true,

      terms: true,

      currency: true,

      issueDate: true,

      dueDate: true,

      subtotalCents: true,

      discountCents: true,

      taxRate: true,

      taxCents: true,

      totalCents: true,

      amountPaidCents: true,

      balanceDueCents: true,

      sentAt: true,

      viewedAt: true,

      paidAt: true,

      overdueAt: true,

      voidedAt: true,

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

      sourceEstimate: {
        select: {
          number: true,
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

      payments: {
        where: {
          status: PaymentStatus.RECORDED,
        },

        orderBy: {
          receivedAt: 'desc',
        },

        select: {
          method: true,

          amountCents: true,

          receivedAt: true,
        },
      },
    };
  }
}

function sanitizePdfFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}
