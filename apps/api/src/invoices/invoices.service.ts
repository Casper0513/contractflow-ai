import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CustomerActivityType,
  EstimateStatus,
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
import type { Environment } from '../config/environment';
import { EmailService } from '../email/email.service';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';
import type { RecordPaymentDto } from './dto/record-payment.dto';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto';
import {
  calculateInvoiceBalance,
  calculateInvoiceTotals,
} from './invoice-calculations';

type InvoiceListOptions = {
  query?: string;
  status?: string;
  sort?: string;
};

const OUTSTANDING_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.VIEWED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

@Injectable()
export class InvoicesService {
  constructor(
    private readonly activityService: ActivityService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  async listForUser(clerkUserId: string, options: InvoiceListOptions = {}) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.invoice.findMany({
      where: this.buildInvoiceListWhere(membership.organizationId, options),
      orderBy: this.buildInvoiceListOrderBy(options.sort),
      select: this.invoiceSelect(),
    });
  }

  async getSummaryForUser(clerkUserId: string) {
    const membership = await this.getMembership(clerkUserId);

    const organizationId = membership.organizationId;

    const [drafts, outstanding, overdue, paid, collected] = await Promise.all([
      prisma.invoice.count({
        where: {
          organizationId,
          status: InvoiceStatus.DRAFT,
        },
      }),

      prisma.invoice.aggregate({
        where: {
          organizationId,
          status: {
            in: OUTSTANDING_INVOICE_STATUSES,
          },
        },
        _sum: {
          balanceDueCents: true,
        },
      }),

      prisma.invoice.aggregate({
        where: {
          organizationId,
          status: InvoiceStatus.OVERDUE,
        },
        _sum: {
          balanceDueCents: true,
        },
      }),

      prisma.invoice.count({
        where: {
          organizationId,
          status: InvoiceStatus.PAID,
        },
      }),

      prisma.invoice.aggregate({
        where: {
          organizationId,
          status: {
            not: InvoiceStatus.VOIDED,
          },
        },
        _sum: {
          amountPaidCents: true,
        },
      }),
    ]);

    return {
      drafts,
      outstandingCents: outstanding._sum.balanceDueCents ?? 0,
      overdueCents: overdue._sum.balanceDueCents ?? 0,
      paid,
      collectedCents: collected._sum.amountPaidCents ?? 0,
    };
  }

  async listForJobForUser(clerkUserId: string, jobId: string) {
    const membership = await this.getMembership(clerkUserId);

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        organizationId: membership.organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return prisma.invoice.findMany({
      where: {
        organizationId: membership.organizationId,
        jobId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: this.invoiceSelect(),
    });
  }

  async listForCustomerForUser(clerkUserId: string, customerId: string) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    return prisma.invoice.findMany({
      where: {
        organizationId: membership.organizationId,
        customerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: this.invoiceSelect(),
    });
  }

  async getByIdForUser(clerkUserId: string, invoiceId: string) {
    const membership = await this.getMembership(clerkUserId);

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId: membership.organizationId,
      },
      select: this.invoiceSelect(),
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async createForUser(clerkUserId: string, input: CreateInvoiceDto) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      await this.requireCustomerForOrganization(
        membership.organizationId,
        input.customerId,
        tx,
      );

      if (input.jobId) {
        await this.requireJobForCustomer(
          membership.organizationId,
          input.customerId,
          input.jobId,
          tx,
        );
      }

      if (input.sourceEstimateId) {
        throw new BadRequestException(
          'Use estimate conversion to create an invoice from an estimate',
        );
      }

      const totals = calculateInvoiceTotals({
        lineItems: input.lineItems,
        discountCents: input.discountCents,
        taxRate: input.taxRate,
      });

      const invoiceNumber = await this.generateInvoiceNumber(
        membership.organizationId,
        tx,
      );

      const invoice = await tx.invoice.create({
        data: {
          organizationId: membership.organizationId,
          customerId: input.customerId,
          jobId: input.jobId ?? null,
          createdByUserId: membership.userId,

          number: invoiceNumber,

          title: clean(input.title),
          notes: clean(input.notes),
          terms: clean(input.terms),

          issueDate: input.issueDate ? new Date(input.issueDate) : new Date(),

          dueDate: input.dueDate ? new Date(input.dueDate) : null,

          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          taxRate: totals.taxRate,
          taxCents: totals.taxCents,
          totalCents: totals.totalCents,

          amountPaidCents: 0,
          balanceDueCents: totals.totalCents,

          lineItems: {
            create: input.lineItems.map((lineItem, index) => {
              const calculated = totals.lineItems[index];

              return {
                description: lineItem.description.trim(),

                quantity: calculated.quantity,

                unitPriceCents: calculated.unitPriceCents,

                lineTotalCents: calculated.lineTotalCents,

                position: index,
              };
            }),
          },
        },
        select: this.invoiceSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: invoice.customerId,
          actorUserId: membership.userId,

          type: CustomerActivityType.INVOICE_CREATED,

          title: 'Invoice created',
          description: `${invoice.number} was created.`,

          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.number,
            totalCents: invoice.totalCents,
            balanceDueCents: invoice.balanceDueCents,
          },
        },
        tx,
      );

      return invoice;
    });
  }

  async updateForUser(
    clerkUserId: string,
    invoiceId: string,
    input: UpdateInvoiceDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const existing = await this.requireInvoiceForOrganization(
        membership.organizationId,
        invoiceId,
        tx,
      );

      this.requireDraft(existing.status);

      const nextCustomerId = input.customerId ?? existing.customerId;

      const nextJobId =
        input.jobId !== undefined ? input.jobId : existing.jobId;

      await this.requireCustomerForOrganization(
        membership.organizationId,
        nextCustomerId,
        tx,
      );

      if (nextJobId) {
        await this.requireJobForCustomer(
          membership.organizationId,
          nextCustomerId,
          nextJobId,
          tx,
        );
      }

      let totals: ReturnType<typeof calculateInvoiceTotals> | undefined;

      if (input.lineItems) {
        totals = calculateInvoiceTotals({
          lineItems: input.lineItems,

          discountCents: input.discountCents ?? existing.discountCents,

          taxRate: input.taxRate ?? Number(existing.taxRate),
        });
      } else if (
        input.discountCents !== undefined ||
        input.taxRate !== undefined
      ) {
        const currentLineItems = await tx.invoiceLineItem.findMany({
          where: {
            invoiceId,
          },
          orderBy: {
            position: 'asc',
          },
          select: {
            quantity: true,
            unitPriceCents: true,
          },
        });

        totals = calculateInvoiceTotals({
          lineItems: currentLineItems.map((lineItem) => ({
            quantity: Number(lineItem.quantity),
            unitPriceCents: lineItem.unitPriceCents,
          })),

          discountCents: input.discountCents ?? existing.discountCents,

          taxRate: input.taxRate ?? Number(existing.taxRate),
        });
      }

      const nextTotalCents = totals?.totalCents ?? existing.totalCents;

      if (existing.amountPaidCents > nextTotalCents) {
        throw new BadRequestException(
          'Invoice total cannot be less than the amount already paid',
        );
      }

      const nextBalanceDueCents = nextTotalCents - existing.amountPaidCents;

      const invoice = await tx.invoice.update({
        where: {
          id: invoiceId,
        },

        data: {
          customerId: nextCustomerId,
          jobId: nextJobId,

          title:
            input.title !== undefined
              ? (clean(input.title) ?? null)
              : undefined,

          notes:
            input.notes !== undefined
              ? (clean(input.notes) ?? null)
              : undefined,

          terms:
            input.terms !== undefined
              ? (clean(input.terms) ?? null)
              : undefined,

          issueDate:
            input.issueDate !== undefined
              ? new Date(input.issueDate)
              : undefined,

          dueDate:
            input.dueDate !== undefined
              ? input.dueDate
                ? new Date(input.dueDate)
                : null
              : undefined,

          subtotalCents: totals?.subtotalCents,

          discountCents: totals?.discountCents,

          taxRate: totals?.taxRate,

          taxCents: totals?.taxCents,

          totalCents: totals?.totalCents,

          balanceDueCents: totals ? nextBalanceDueCents : undefined,

          ...(input.lineItems
            ? {
                lineItems: {
                  deleteMany: {},

                  create: input.lineItems.map((lineItem, index) => {
                    const calculated = totals!.lineItems[index];

                    return {
                      description: lineItem.description.trim(),

                      quantity: calculated.quantity,

                      unitPriceCents: calculated.unitPriceCents,

                      lineTotalCents: calculated.lineTotalCents,

                      position: index,
                    };
                  }),
                },
              }
            : {}),
        },

        select: this.invoiceSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,

          customerId: invoice.customerId,

          actorUserId: membership.userId,

          type: CustomerActivityType.INVOICE_UPDATED,

          title: 'Invoice updated',

          description: `${invoice.number} was updated.`,

          metadata: {
            invoiceId: invoice.id,

            invoiceNumber: invoice.number,

            totalCents: invoice.totalCents,

            balanceDueCents: invoice.balanceDueCents,
          },
        },
        tx,
      );

      return invoice;
    });
  }

  async createFromEstimateForUser(clerkUserId: string, estimateId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const estimate = await tx.estimate.findFirst({
        where: {
          id: estimateId,

          organizationId: membership.organizationId,
        },

        select: {
          id: true,
          organizationId: true,
          customerId: true,
          jobId: true,

          number: true,
          status: true,

          title: true,
          notes: true,
          terms: true,

          subtotalCents: true,
          discountCents: true,
          taxRate: true,
          taxCents: true,
          totalCents: true,

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
        },
      });

      if (!estimate) {
        throw new NotFoundException('Estimate not found');
      }

      if (estimate.status !== EstimateStatus.APPROVED) {
        throw new BadRequestException(
          'Only approved estimates can be converted to invoices',
        );
      }

      const existingInvoice = await tx.invoice.findFirst({
        where: {
          organizationId: membership.organizationId,

          sourceEstimateId: estimate.id,
        },

        select: {
          id: true,
          number: true,
        },
      });

      if (existingInvoice) {
        throw new BadRequestException(
          `Estimate ${estimate.number} has already been converted to invoice ${existingInvoice.number}`,
        );
      }

      await this.requireCustomerForOrganization(
        membership.organizationId,
        estimate.customerId,
        tx,
      );

      if (estimate.jobId) {
        await this.requireJobForCustomer(
          membership.organizationId,
          estimate.customerId,
          estimate.jobId,
          tx,
        );
      }

      if (estimate.lineItems.length === 0) {
        throw new BadRequestException(
          'Estimate must contain at least one line item',
        );
      }

      const invoiceNumber = await this.generateInvoiceNumber(
        membership.organizationId,
        tx,
      );

      const invoice = await tx.invoice.create({
        data: {
          organizationId: membership.organizationId,

          customerId: estimate.customerId,

          jobId: estimate.jobId,

          sourceEstimateId: estimate.id,

          createdByUserId: membership.userId,

          number: invoiceNumber,

          title: estimate.title,

          notes: estimate.notes,

          terms: estimate.terms,

          issueDate: new Date(),

          subtotalCents: estimate.subtotalCents,

          discountCents: estimate.discountCents,

          taxRate: estimate.taxRate,

          taxCents: estimate.taxCents,

          totalCents: estimate.totalCents,

          amountPaidCents: 0,

          balanceDueCents: estimate.totalCents,

          lineItems: {
            create: estimate.lineItems.map((lineItem) => ({
              description: lineItem.description,

              quantity: lineItem.quantity,

              unitPriceCents: lineItem.unitPriceCents,

              lineTotalCents: lineItem.lineTotalCents,

              position: lineItem.position,
            })),
          },
        },

        select: this.invoiceSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,

          customerId: invoice.customerId,

          actorUserId: membership.userId,

          type: CustomerActivityType.INVOICE_CREATED,

          title: 'Invoice created from estimate',

          description: `${invoice.number} was created from ${estimate.number}.`,

          metadata: {
            invoiceId: invoice.id,

            invoiceNumber: invoice.number,

            estimateId: estimate.id,

            estimateNumber: estimate.number,

            totalCents: invoice.totalCents,

            balanceDueCents: invoice.balanceDueCents,
          },
        },
        tx,
      );

      return invoice;
    });
  }

  async sendForUser(clerkUserId: string, invoiceId: string) {
    const membership = await this.getMembership(clerkUserId);

    const invoice = await this.requireFullInvoiceForOrganization(
      membership.organizationId,
      invoiceId,
    );

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Invoice cannot transition from ${invoice.status} to ${InvoiceStatus.SENT}`,
      );
    }

    const customerEmail = invoice.customer.email?.trim().toLowerCase();

    if (!customerEmail) {
      throw new BadRequestException(
        'Customer must have an email address before the invoice can be sent',
      );
    }

    const organization = await prisma.organization.findUnique({
      where: {
        id: membership.organizationId,
      },
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
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const customerName = [invoice.customer.firstName, invoice.customer.lastName]
      .filter(Boolean)
      .join(' ');

    const businessName = organization.legalName || organization.name;

    const publicAccess = await this.ensurePublicAccessForDraft(
      membership.organizationId,
      invoice.id,
    );

    const publicInvoiceUrl = new URL(
      `/i/${publicAccess.token}`,
      this.configService.get('WEB_URL', {
        infer: true,
      }),
    ).toString();

    const pdf = await createInvoicePdf(
      this.toInvoicePdfInvoice(invoice),
      this.toInvoicePdfOrganization(organization),
    );

    try {
      await this.emailService.send({
        to: customerEmail,
        subject: `Invoice ${invoice.number} from ${organization.name}`,
        html: this.buildInvoiceEmailHtml({
          invoice,
          organizationName: organization.name,
          businessName,
          customerName,
          publicInvoiceUrl,
        }),
        text: this.buildInvoiceEmailText({
          invoice,
          organizationName: organization.name,
          businessName,
          customerName,
          publicInvoiceUrl,
        }),
        attachments: [
          {
            filename: sanitizePdfFilename(`${invoice.number}.pdf`),
            content: pdf,
          },
        ],
        replyTo: organization.email ?? undefined,
        idempotencyKey: `invoice-send/${invoice.id}/${invoice.updatedAt.toISOString()}`,
      });
    } catch (error) {
      if (publicAccess.created) {
        await prisma.invoice.updateMany({
          where: {
            id: invoice.id,
            organizationId: membership.organizationId,
            status: InvoiceStatus.DRAFT,
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

    return prisma.$transaction(async (tx) => {
      const now = new Date();

      const result = await tx.invoice.updateMany({
        where: {
          id: invoiceId,
          organizationId: membership.organizationId,
          status: InvoiceStatus.DRAFT,
        },
        data: {
          status: InvoiceStatus.SENT,
          sentAt: now,
        },
      });

      if (result.count !== 1) {
        const current = await tx.invoice.findFirst({
          where: {
            id: invoiceId,
            organizationId: membership.organizationId,
          },
          select: {
            status: true,
          },
        });

        if (!current) {
          throw new NotFoundException('Invoice not found');
        }

        throw new BadRequestException(
          `Invoice cannot transition from ${current.status} to ${InvoiceStatus.SENT}`,
        );
      }

      const sentInvoice = await this.requireFullInvoiceForOrganization(
        membership.organizationId,
        invoiceId,
        tx,
      );

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: sentInvoice.customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.INVOICE_SENT,
          title: 'Invoice sent',
          description: `${sentInvoice.number} was emailed to ${customerEmail}.`,
          metadata: {
            invoiceId: sentInvoice.id,
            invoiceNumber: sentInvoice.number,
            previousStatus: invoice.status,
            status: sentInvoice.status,
            totalCents: sentInvoice.totalCents,
            balanceDueCents: sentInvoice.balanceDueCents,
            recipientEmail: customerEmail,
          },
        },
        tx,
      );

      return sentInvoice;
    });
  }

  async viewForUser(clerkUserId: string, invoiceId: string) {
    return this.transitionForUser(
      clerkUserId,
      invoiceId,
      [InvoiceStatus.SENT],
      InvoiceStatus.VIEWED,
      'viewedAt',
      CustomerActivityType.INVOICE_VIEWED,
      'Invoice viewed',
      'was viewed.',
    );
  }

  async markOverdueForUser(clerkUserId: string, invoiceId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const existing = await this.requireInvoiceForOrganization(
        membership.organizationId,
        invoiceId,
        tx,
      );

      const overdueEligibleStatuses: InvoiceStatus[] = [
        InvoiceStatus.SENT,
        InvoiceStatus.VIEWED,
        InvoiceStatus.PARTIALLY_PAID,
      ];

      if (!overdueEligibleStatuses.includes(existing.status)) {
        throw new BadRequestException(
          `Invoice cannot transition from ${existing.status} to ${InvoiceStatus.OVERDUE}`,
        );
      }

      if (!existing.dueDate) {
        throw new BadRequestException('Invoice does not have a due date');
      }

      if (existing.dueDate.getTime() > Date.now()) {
        throw new BadRequestException('Invoice is not overdue yet');
      }

      const now = new Date();

      const result = await tx.invoice.updateMany({
        where: {
          id: invoiceId,

          organizationId: membership.organizationId,

          status: {
            in: [
              InvoiceStatus.SENT,
              InvoiceStatus.VIEWED,
              InvoiceStatus.PARTIALLY_PAID,
            ],
          },

          balanceDueCents: {
            gt: 0,
          },
        },

        data: {
          status: InvoiceStatus.OVERDUE,

          overdueAt: now,
        },
      });

      if (result.count !== 1) {
        throw new BadRequestException('Invoice could not be marked overdue');
      }

      const invoice = await this.requireFullInvoiceForOrganization(
        membership.organizationId,
        invoiceId,
        tx,
      );

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,

          customerId: invoice.customerId,

          actorUserId: membership.userId,

          type: CustomerActivityType.INVOICE_OVERDUE,

          title: 'Invoice overdue',

          description: `${invoice.number} was marked overdue.`,

          metadata: {
            invoiceId: invoice.id,

            invoiceNumber: invoice.number,

            balanceDueCents: invoice.balanceDueCents,
          },
        },
        tx,
      );

      return invoice;
    });
  }

  async voidForUser(clerkUserId: string, invoiceId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const existing = await this.requireInvoiceForOrganization(
        membership.organizationId,
        invoiceId,
        tx,
      );

      if (existing.status === InvoiceStatus.VOIDED) {
        throw new BadRequestException('Invoice is already voided');
      }

      if (existing.amountPaidCents > 0) {
        throw new BadRequestException(
          'Void recorded payments before voiding the invoice',
        );
      }

      if (existing.status === InvoiceStatus.PAID) {
        throw new BadRequestException(
          'A paid invoice cannot be voided while payments are recorded',
        );
      }

      const now = new Date();

      const result = await tx.invoice.updateMany({
        where: {
          id: invoiceId,

          organizationId: membership.organizationId,

          status: {
            not: InvoiceStatus.VOIDED,
          },

          amountPaidCents: 0,
        },

        data: {
          status: InvoiceStatus.VOIDED,

          voidedAt: now,
        },
      });

      if (result.count !== 1) {
        throw new BadRequestException('Invoice could not be voided');
      }

      const invoice = await this.requireFullInvoiceForOrganization(
        membership.organizationId,
        invoiceId,
        tx,
      );

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,

          customerId: invoice.customerId,

          actorUserId: membership.userId,

          type: CustomerActivityType.INVOICE_VOIDED,

          title: 'Invoice voided',

          description: `${invoice.number} was voided.`,

          metadata: {
            invoiceId: invoice.id,

            invoiceNumber: invoice.number,

            totalCents: invoice.totalCents,
          },
        },
        tx,
      );

      return invoice;
    });
  }

  async recordPaymentForUser(
    clerkUserId: string,
    invoiceId: string,
    input: RecordPaymentDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const invoice = await this.requireInvoiceForOrganization(
        membership.organizationId,
        invoiceId,
        tx,
      );

      if (invoice.status === InvoiceStatus.DRAFT) {
        throw new BadRequestException('Draft invoices cannot accept payments');
      }

      if (invoice.status === InvoiceStatus.VOIDED) {
        throw new BadRequestException('Voided invoices cannot accept payments');
      }

      if (invoice.balanceDueCents <= 0) {
        throw new BadRequestException('Invoice is already fully paid');
      }

      if (input.amountCents > invoice.balanceDueCents) {
        throw new BadRequestException(
          'Payment cannot exceed the invoice balance',
        );
      }

      const payment = await tx.payment.create({
        data: {
          organizationId: membership.organizationId,

          customerId: invoice.customerId,

          invoiceId: invoice.id,

          recordedByUserId: membership.userId,

          method: input.method,

          amountCents: input.amountCents,

          reference: clean(input.reference),

          notes: clean(input.notes),

          receivedAt: input.receivedAt
            ? new Date(input.receivedAt)
            : new Date(),
        },

        select: {
          id: true,
          amountCents: true,
          method: true,
          receivedAt: true,
        },
      });

      const updatedInvoice = await this.recalculateInvoicePaymentState(
        membership.organizationId,
        invoiceId,
        tx,
      );

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,

          customerId: updatedInvoice.customerId,

          actorUserId: membership.userId,

          type: CustomerActivityType.PAYMENT_RECEIVED,

          title: 'Payment received',

          description: `${formatMoneyForActivity(
            payment.amountCents,
          )} was recorded against ${updatedInvoice.number}.`,

          metadata: {
            paymentId: payment.id,

            invoiceId: updatedInvoice.id,

            invoiceNumber: updatedInvoice.number,

            amountCents: payment.amountCents,

            method: payment.method,

            amountPaidCents: updatedInvoice.amountPaidCents,

            balanceDueCents: updatedInvoice.balanceDueCents,

            status: updatedInvoice.status,
          },
        },
        tx,
      );

      if (updatedInvoice.status === InvoiceStatus.PAID) {
        await this.activityService.recordCustomerActivity(
          {
            organizationId: membership.organizationId,

            customerId: updatedInvoice.customerId,

            actorUserId: membership.userId,

            type: CustomerActivityType.INVOICE_PAID,

            title: 'Invoice paid',

            description: `${updatedInvoice.number} was paid in full.`,

            metadata: {
              invoiceId: updatedInvoice.id,

              invoiceNumber: updatedInvoice.number,

              totalCents: updatedInvoice.totalCents,
            },
          },
          tx,
        );
      } else {
        await this.activityService.recordCustomerActivity(
          {
            organizationId: membership.organizationId,

            customerId: updatedInvoice.customerId,

            actorUserId: membership.userId,

            type: CustomerActivityType.INVOICE_PARTIALLY_PAID,

            title: 'Invoice partially paid',

            description: `${updatedInvoice.number} has a remaining balance.`,

            metadata: {
              invoiceId: updatedInvoice.id,

              invoiceNumber: updatedInvoice.number,

              amountPaidCents: updatedInvoice.amountPaidCents,

              balanceDueCents: updatedInvoice.balanceDueCents,
            },
          },
          tx,
        );
      }

      return updatedInvoice;
    });
  }

  async voidPaymentForUser(
    clerkUserId: string,
    invoiceId: string,
    paymentId: string,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      await this.requireInvoiceForOrganization(
        membership.organizationId,
        invoiceId,
        tx,
      );

      const payment = await tx.payment.findFirst({
        where: {
          id: paymentId,

          invoiceId,

          organizationId: membership.organizationId,
        },

        select: {
          id: true,
          customerId: true,
          status: true,
          amountCents: true,
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.status === PaymentStatus.VOIDED) {
        throw new BadRequestException('Payment is already voided');
      }

      const now = new Date();

      const result = await tx.payment.updateMany({
        where: {
          id: paymentId,

          invoiceId,

          organizationId: membership.organizationId,

          status: PaymentStatus.RECORDED,
        },

        data: {
          status: PaymentStatus.VOIDED,

          voidedAt: now,
        },
      });

      if (result.count !== 1) {
        throw new BadRequestException('Payment could not be voided');
      }

      const updatedInvoice = await this.recalculateInvoicePaymentState(
        membership.organizationId,
        invoiceId,
        tx,
      );

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,

          customerId: updatedInvoice.customerId,

          actorUserId: membership.userId,

          type: CustomerActivityType.PAYMENT_VOIDED,

          title: 'Payment voided',

          description: `A payment on ${updatedInvoice.number} was voided.`,

          metadata: {
            paymentId: payment.id,

            invoiceId: updatedInvoice.id,

            invoiceNumber: updatedInvoice.number,

            amountCents: payment.amountCents,

            amountPaidCents: updatedInvoice.amountPaidCents,

            balanceDueCents: updatedInvoice.balanceDueCents,

            status: updatedInvoice.status,
          },
        },
        tx,
      );

      return updatedInvoice;
    });
  }

  private async recalculateInvoicePaymentState(
    organizationId: string,
    invoiceId: string,
    tx: Prisma.TransactionClient,
  ) {
    const invoice = await this.requireInvoiceForOrganization(
      organizationId,
      invoiceId,
      tx,
    );

    const aggregate = await tx.payment.aggregate({
      where: {
        organizationId,
        invoiceId,
        status: PaymentStatus.RECORDED,
      },

      _sum: {
        amountCents: true,
      },
    });

    const amountPaidCents = aggregate._sum.amountCents ?? 0;

    const balance = calculateInvoiceBalance(
      invoice.totalCents,
      amountPaidCents,
    );

    const nextStatus =
      balance.balanceDueCents === 0
        ? InvoiceStatus.PAID
        : amountPaidCents > 0
          ? InvoiceStatus.PARTIALLY_PAID
          : this.statusAfterPaymentsRemoved(invoice);

    const now = new Date();

    await tx.invoice.update({
      where: {
        id: invoiceId,
      },

      data: {
        amountPaidCents: balance.amountPaidCents,

        balanceDueCents: balance.balanceDueCents,

        status: nextStatus,

        paidAt:
          nextStatus === InvoiceStatus.PAID ? (invoice.paidAt ?? now) : null,
      },
    });

    return this.requireFullInvoiceForOrganization(
      organizationId,
      invoiceId,
      tx,
    );
  }

  private statusAfterPaymentsRemoved(invoice: {
    status: InvoiceStatus;
    sentAt: Date | null;
    viewedAt: Date | null;
    overdueAt: Date | null;
    dueDate: Date | null;
  }) {
    if (
      invoice.overdueAt &&
      invoice.dueDate &&
      invoice.dueDate.getTime() < Date.now()
    ) {
      return InvoiceStatus.OVERDUE;
    }

    if (invoice.viewedAt) {
      return InvoiceStatus.VIEWED;
    }

    if (invoice.sentAt) {
      return InvoiceStatus.SENT;
    }

    return InvoiceStatus.DRAFT;
  }

  private async ensurePublicAccessForDraft(
    organizationId: string,
    invoiceId: string,
  ): Promise<{
    token: string;
    created: boolean;
  }> {
    const existing = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId,
      },
      select: {
        status: true,
        publicAccessToken: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }

    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Invoice cannot transition from ${existing.status} to ${InvoiceStatus.SENT}`,
      );
    }

    if (existing.publicAccessToken) {
      return {
        token: existing.publicAccessToken,
        created: false,
      };
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const token = randomBytes(32).toString('base64url');

      try {
        const result = await prisma.invoice.updateMany({
          where: {
            id: invoiceId,
            organizationId,
            status: InvoiceStatus.DRAFT,
            publicAccessToken: null,
          },
          data: {
            publicAccessToken: token,
            publicAccessCreatedAt: new Date(),
          },
        });

        if (result.count === 1) {
          return {
            token,
            created: true,
          };
        }

        const current = await prisma.invoice.findFirst({
          where: {
            id: invoiceId,
            organizationId,
          },
          select: {
            status: true,
            publicAccessToken: true,
          },
        });

        if (!current) {
          throw new NotFoundException('Invoice not found');
        }

        if (current.status !== InvoiceStatus.DRAFT) {
          throw new BadRequestException(
            `Invoice cannot transition from ${current.status} to ${InvoiceStatus.SENT}`,
          );
        }

        if (current.publicAccessToken) {
          return {
            token: current.publicAccessToken,
            created: false,
          };
        }
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new BadRequestException(
      'Unable to create secure public access for this invoice',
    );
  }

  private toInvoicePdfInvoice(
    invoice: Awaited<
      ReturnType<InvoicesService['requireFullInvoiceForOrganization']>
    >,
  ): InvoicePdfInvoice {
    return {
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

      lineItems: invoice.lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity.toString(),
        unitPriceCents: item.unitPriceCents,
        lineTotalCents: item.lineTotalCents,
      })),

      payments: invoice.payments.map((payment) => ({
        status: payment.status,
        method: payment.method,
        amountCents: payment.amountCents,
        reference: payment.reference,
        receivedAt: payment.receivedAt,
      })),
    };
  }

  private toInvoicePdfOrganization(organization: {
    name: string;
    legalName: string | null;
    email: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    country: string;
    taxNumber: string | null;
    website: string | null;
  }): InvoicePdfOrganization {
    return {
      name: organization.name,
      legalName: organization.legalName,
      email: organization.email,
      phone: organization.phone,
      addressLine1: organization.addressLine1,
      addressLine2: organization.addressLine2,
      city: organization.city,
      province: organization.province,
      postalCode: organization.postalCode,
      country: organization.country,
      taxNumber: organization.taxNumber,
      website: organization.website,
    };
  }

  private buildInvoiceEmailHtml({
    invoice,
    organizationName,
    businessName,
    customerName,
    publicInvoiceUrl,
  }: {
    invoice: Awaited<
      ReturnType<InvoicesService['requireFullInvoiceForOrganization']>
    >;
    organizationName: string;
    businessName: string;
    customerName: string;
    publicInvoiceUrl: string;
  }) {
    const title = invoice.title?.trim();

    const dueDate = invoice.dueDate
      ? formatDateForEmail(invoice.dueDate)
      : 'No due date';

    const escapedCustomerName = escapeHtml(customerName || 'Customer');
    const escapedOrganizationName = escapeHtml(organizationName);
    const escapedBusinessName = escapeHtml(businessName);
    const escapedInvoiceNumber = escapeHtml(invoice.number);
    const escapedPublicInvoiceUrl = escapeHtml(publicInvoiceUrl);
    const escapedTitle = title ? escapeHtml(title) : null;

    return `
      <!doctype html>
      <html>
        <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">
                  <tr>
                    <td style="padding:32px;">
                      <div style="font-size:14px;color:#71717a;margin-bottom:8px;">${escapedOrganizationName}</div>
                      <h1 style="margin:0;font-size:24px;line-height:1.3;">Invoice ${escapedInvoiceNumber}</h1>
                      ${
                        escapedTitle
                          ? `<p style="margin:8px 0 0;color:#52525b;">${escapedTitle}</p>`
                          : ''
                      }

                      <p style="margin:28px 0 0;line-height:1.6;">
                        Hello ${escapedCustomerName},
                      </p>

                      <p style="margin:16px 0 0;line-height:1.6;color:#3f3f46;">
                        ${escapedBusinessName} has sent you invoice ${escapedInvoiceNumber}.
                      </p>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border-collapse:collapse;">
                        <tr>
                          <td style="padding:12px 0;border-bottom:1px solid #e4e4e7;color:#71717a;">Invoice total</td>
                          <td align="right" style="padding:12px 0;border-bottom:1px solid #e4e4e7;font-weight:700;">${escapeHtml(
                            formatMoneyForEmail(
                              invoice.totalCents,
                              invoice.currency,
                            ),
                          )}</td>
                        </tr>
                        <tr>
                          <td style="padding:12px 0;border-bottom:1px solid #e4e4e7;color:#71717a;">Balance due</td>
                          <td align="right" style="padding:12px 0;border-bottom:1px solid #e4e4e7;font-weight:700;">${escapeHtml(
                            formatMoneyForEmail(
                              invoice.balanceDueCents,
                              invoice.currency,
                            ),
                          )}</td>
                        </tr>
                        <tr>
                          <td style="padding:12px 0;color:#71717a;">Due date</td>
                          <td align="right" style="padding:12px 0;font-weight:600;">${escapeHtml(
                            dueDate,
                          )}</td>
                        </tr>
                      </table>

                      <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:28px;">
                        <tr>
                          <td style="border-radius:8px;background:#18181b;">
                            <a
                              href="${escapedPublicInvoiceUrl}"
                              style="display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;"
                            >
                              View Invoice
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:28px 0 0;line-height:1.6;color:#52525b;">
                        Please contact ${escapedOrganizationName} if you have any questions about this invoice.
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

  private buildInvoiceEmailText({
    invoice,
    organizationName,
    businessName,
    customerName,
    publicInvoiceUrl,
  }: {
    invoice: Awaited<
      ReturnType<InvoicesService['requireFullInvoiceForOrganization']>
    >;
    organizationName: string;
    businessName: string;
    customerName: string;
    publicInvoiceUrl: string;
  }) {
    const lines = [
      `Hello ${customerName || 'Customer'},`,
      '',
      `${businessName} has sent you invoice ${invoice.number}.`,
    ];

    if (invoice.title?.trim()) {
      lines.push(`Invoice: ${invoice.title.trim()}`);
    }

    lines.push(
      `Total: ${formatMoneyForEmail(invoice.totalCents, invoice.currency)}`,
      `Balance due: ${formatMoneyForEmail(
        invoice.balanceDueCents,
        invoice.currency,
      )}`,
      `Due date: ${
        invoice.dueDate ? formatDateForEmail(invoice.dueDate) : 'No due date'
      }`,
      '',
      `View invoice: ${publicInvoiceUrl}`,
      '',
      `Please contact ${organizationName} if you have any questions about this invoice.`,
    );

    return lines.join('\n');
  }

  private async transitionForUser(
    clerkUserId: string,
    invoiceId: string,
    allowedStatuses: InvoiceStatus[],
    nextStatus: InvoiceStatus,
    timestampField: 'sentAt' | 'viewedAt',
    activityType: CustomerActivityType,
    activityTitle: string,
    activityDescription: string,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const existing = await this.requireInvoiceForOrganization(
        membership.organizationId,
        invoiceId,
        tx,
      );

      if (!allowedStatuses.includes(existing.status)) {
        throw new BadRequestException(
          `Invoice cannot transition from ${existing.status} to ${nextStatus}`,
        );
      }

      const now = new Date();

      const result = await tx.invoice.updateMany({
        where: {
          id: invoiceId,

          organizationId: membership.organizationId,

          status: {
            in: allowedStatuses,
          },
        },

        data: {
          status: nextStatus,

          [timestampField]: now,
        },
      });

      if (result.count !== 1) {
        const current = await tx.invoice.findFirst({
          where: {
            id: invoiceId,

            organizationId: membership.organizationId,
          },

          select: {
            status: true,
          },
        });

        if (!current) {
          throw new NotFoundException('Invoice not found');
        }

        throw new BadRequestException(
          `Invoice cannot transition from ${current.status} to ${nextStatus}`,
        );
      }

      const invoice = await this.requireFullInvoiceForOrganization(
        membership.organizationId,
        invoiceId,
        tx,
      );

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,

          customerId: invoice.customerId,

          actorUserId: membership.userId,

          type: activityType,

          title: activityTitle,

          description: `${invoice.number} ${activityDescription}`,

          metadata: {
            invoiceId: invoice.id,

            invoiceNumber: invoice.number,

            previousStatus: existing.status,

            status: invoice.status,

            totalCents: invoice.totalCents,

            balanceDueCents: invoice.balanceDueCents,
          },
        },
        tx,
      );

      return invoice;
    });
  }

  private buildInvoiceListWhere(
    organizationId: string,
    options: InvoiceListOptions,
  ): Prisma.InvoiceWhereInput {
    const where: Prisma.InvoiceWhereInput = {
      organizationId,
    };

    const query = options.query?.trim();

    if (query) {
      where.OR = [
        {
          number: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          title: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          customer: {
            is: {
              OR: [
                {
                  firstName: {
                    contains: query,
                    mode: 'insensitive',
                  },
                },
                {
                  lastName: {
                    contains: query,
                    mode: 'insensitive',
                  },
                },
                {
                  companyName: {
                    contains: query,
                    mode: 'insensitive',
                  },
                },
              ],
            },
          },
        },
        {
          job: {
            is: {
              name: {
                contains: query,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }

    const status = options.status?.trim().toUpperCase();

    if (status && status !== 'ALL') {
      if (status === 'OUTSTANDING') {
        where.status = {
          in: OUTSTANDING_INVOICE_STATUSES,
        };
      } else {
        const invoiceStatus = Object.values(InvoiceStatus).find(
          (value) => value === status,
        );

        if (!invoiceStatus) {
          throw new BadRequestException(
            `Unsupported invoice status filter: ${options.status}`,
          );
        }

        where.status = invoiceStatus;
      }
    }

    return where;
  }

  private buildInvoiceListOrderBy(
    sort?: string,
  ): Prisma.InvoiceOrderByWithRelationInput[] {
    switch (sort?.trim().toLowerCase()) {
      case undefined:
      case '':
      case 'newest':
        return [
          {
            createdAt: 'desc',
          },
        ];

      case 'oldest':
        return [
          {
            createdAt: 'asc',
          },
        ];

      case 'due-soonest':
        return [
          {
            dueDate: 'asc',
          },
          {
            createdAt: 'desc',
          },
        ];

      case 'total-desc':
        return [
          {
            totalCents: 'desc',
          },
          {
            createdAt: 'desc',
          },
        ];

      case 'balance-desc':
        return [
          {
            balanceDueCents: 'desc',
          },
          {
            createdAt: 'desc',
          },
        ];

      default:
        throw new BadRequestException(`Unsupported invoice sort: ${sort}`);
    }
  }

  private requireDraft(status: InvoiceStatus) {
    if (status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be edited');
    }
  }

  private async generateInvoiceNumber(
    organizationId: string,
    tx: Prisma.TransactionClient,
  ) {
    const organization = await tx.organization.update({
      where: {
        id: organizationId,
      },

      data: {
        nextInvoiceNumber: {
          increment: 1,
        },
      },

      select: {
        nextInvoiceNumber: true,
      },
    });

    const sequence = organization.nextInvoiceNumber - 1;

    return `INV-${String(sequence).padStart(5, '0')}`;
  }

  private async requireInvoiceForOrganization(
    organizationId: string,
    invoiceId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const invoice = await client.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId,
      },

      select: {
        id: true,
        customerId: true,
        jobId: true,
        sourceEstimateId: true,

        status: true,

        discountCents: true,
        taxRate: true,

        totalCents: true,
        amountPaidCents: true,
        balanceDueCents: true,

        dueDate: true,

        sentAt: true,
        viewedAt: true,
        paidAt: true,
        overdueAt: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  private async requireFullInvoiceForOrganization(
    organizationId: string,
    invoiceId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const invoice = await client.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId,
      },

      select: this.invoiceSelect(),
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  private async requireCustomerForOrganization(
    organizationId: string,
    customerId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const customer = await client.customer.findFirst({
      where: {
        id: customerId,
        organizationId,
      },

      select: {
        id: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  private async requireJobForCustomer(
    organizationId: string,
    customerId: string,
    jobId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const job = await client.job.findFirst({
      where: {
        id: jobId,
        organizationId,
        customerId,
      },

      select: {
        id: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found for this customer');
    }

    return job;
  }

  private async getMembership(clerkUserId: string) {
    const membership = await prisma.membership.findFirst({
      where: {
        user: {
          clerkUserId,
        },
      },

      select: {
        organizationId: true,

        userId: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('No organization membership found');
    }

    return membership;
  }

  private invoiceSelect(): Prisma.InvoiceSelect {
    return {
      id: true,
      organizationId: true,
      customerId: true,
      jobId: true,
      sourceEstimateId: true,
      createdByUserId: true,

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

      createdAt: true,
      updatedAt: true,

      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          companyName: true,
          email: true,
          phone: true,
        },
      },

      job: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },

      sourceEstimate: {
        select: {
          id: true,
          number: true,
          status: true,
          title: true,
          totalCents: true,
        },
      },

      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },

      lineItems: {
        orderBy: {
          position: 'asc',
        },

        select: {
          id: true,
          description: true,
          quantity: true,
          unitPriceCents: true,
          lineTotalCents: true,
          position: true,
          createdAt: true,
          updatedAt: true,
        },
      },

      payments: {
        orderBy: {
          receivedAt: 'desc',
        },

        select: {
          id: true,
          status: true,
          method: true,
          amountCents: true,
          reference: true,
          notes: true,
          receivedAt: true,
          voidedAt: true,
          createdAt: true,
          updatedAt: true,

          recordedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    };
  }
}

function formatMoneyForEmail(cents: number, currency: string) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function formatDateForEmail(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function sanitizePdfFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function clean(value: string | undefined): string | undefined {
  const result = value?.trim();

  return result || undefined;
}

function formatMoneyForActivity(cents: number) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(cents / 100);
}
