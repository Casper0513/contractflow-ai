import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CommunicationCategory,
  CustomerActivityType,
  EstimateStatus,
  InvoiceStatus,
  JobMaterialStatus,
  PaymentStatus,
} from '@contractflow/db';
import {
  createInvoicePdf,
  type InvoicePdfInvoice,
  type InvoicePdfOrganization,
} from '@contractflow/invoice-pdf';
import {
  type DatabaseTransaction,
  db,
  isPrisma8UniqueViolation,
  toPrisma8Numeric,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { OrganizationMembershipService } from '../auth/organization-membership.service';
import type { Environment } from '../config/environment';
import { CustomerCommunicationsService } from '../customer-communications/customer-communications.service';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';
import type { RecordPaymentDto } from './dto/record-payment.dto';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { formatMoney as formatCurrencyAmount } from '../common/money/money';
import {
  calculateInvoiceBalance,
  calculateInvoiceTotals,
} from './invoice-calculations';
import {
  type InvoiceActivityType,
  clearInvoicePublicAccessPrisma8,
  createInvoiceLineItemPrisma8,
  createPaymentPrisma8,
  executeInvoiceTransitionCasPrisma8,
  executeOverdueInvoiceCasPrisma8,
  executeSendInvoiceCasPrisma8,
  executeVoidInvoiceCasPrisma8,
  executeVoidPaymentCasPrisma8,
  generateInvoiceNumberPrisma8,
  getInvoiceSummaryPrisma8,
  hydrateFullInvoicePrisma8,
  listInvoicesForCustomerPrisma8,
  listInvoicesForJobPrisma8,
  listInvoicesPrisma8,
  requireCustomerForOrganizationPrisma8,
  requireInvoiceForOrganizationPrisma8,
  requireJobForCustomerPrisma8,
  reserveInvoicePublicAccessPrisma8,
  sumRecordedPaymentsPrisma8,
  updateInvoicePaymentStatePrisma8,
  writeInvoiceActivityPrisma8,
} from './invoices.prisma8';

type InvoiceListOptions = {
  query?: string;
  status?: string;
  sort?: string;
};

type HydratedInvoicePrisma8 = Awaited<
  ReturnType<typeof hydrateFullInvoicePrisma8>
>;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly customerCommunicationsService: CustomerCommunicationsService,
    private readonly configService: ConfigService<Environment, true>,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async listForUser(
    clerkUserId: string,
    options: InvoiceListOptions = {},
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return listInvoicesPrisma8(membership.organizationId, options);
  }

  async getSummaryForUser(clerkUserId: string, activeOrganizationId?: string) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return getInvoiceSummaryPrisma8(membership.organizationId);
  }

  async listForJobForUser(
    clerkUserId: string,
    jobId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return listInvoicesForJobPrisma8(membership.organizationId, jobId);
  }

  async listForCustomerForUser(
    clerkUserId: string,
    customerId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return listInvoicesForCustomerPrisma8(
      membership.organizationId,
      customerId,
    );
  }

  async getByIdForUser(
    clerkUserId: string,
    invoiceId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return hydrateFullInvoicePrisma8(membership.organizationId, invoiceId);
  }

  async createForUser(
    clerkUserId: string,
    input: CreateInvoiceDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      await requireCustomerForOrganizationPrisma8(
        membership.organizationId,
        input.customerId,
        tx.orm,
      );

      const job = input.jobId
        ? await requireJobForCustomerPrisma8(
            membership.organizationId,
            input.customerId,
            input.jobId,
            tx.orm,
          )
        : null;

      if (input.sourceEstimateId) {
        throw new BadRequestException(
          'Use estimate conversion to create an invoice from an estimate',
        );
      }

      const organization = await tx.orm.public.Organization.where({
        id: membership.organizationId,
      })
        .select('currency')
        .first();

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      const totals = calculateInvoiceTotals({
        lineItems: input.lineItems,

        discountCents: input.discountCents,

        taxRate: input.taxRate,
      });

      const invoiceNumber = await generateInvoiceNumberPrisma8(
        membership.organizationId,
        tx,
      );

      const now = toPrisma8Timestamp();

      const invoice = await tx.orm.public.Invoice.create({
        organizationId: membership.organizationId,

        customerId: input.customerId,

        jobId: input.jobId ?? null,

        sourceEstimateId: null,

        createdByUserId: membership.userId,

        number: invoiceNumber,

        status: InvoiceStatus.DRAFT,

        title: clean(input.title) ?? null,

        notes: clean(input.notes) ?? null,

        terms: clean(input.terms) ?? null,

        currency: job?.currency ?? organization.currency,

        issueDate: input.issueDate
          ? toPrisma8Timestamp(new Date(input.issueDate))
          : now,

        dueDate: input.dueDate
          ? toPrisma8Timestamp(new Date(input.dueDate))
          : null,

        subtotalCents: totals.subtotalCents,

        discountCents: totals.discountCents,

        taxRate: toPrisma8Numeric(String(totals.taxRate), 7, 4),

        taxCents: totals.taxCents,

        totalCents: totals.totalCents,

        amountPaidCents: 0,

        balanceDueCents: totals.totalCents,

        sentAt: null,

        viewedAt: null,

        paidAt: null,

        overdueAt: null,

        voidedAt: null,

        createdAt: now,

        updatedAt: now,

        publicAccessCreatedAt: null,

        publicAccessToken: null,
      });

      for (let index = 0; index < input.lineItems.length; index += 1) {
        const lineItem = input.lineItems[index];

        const calculated = totals.lineItems[index];

        await createInvoiceLineItemPrisma8(tx, {
          invoiceId: invoice.id,

          description: lineItem.description.trim(),

          quantity: calculated.quantity,

          unitPriceCents: calculated.unitPriceCents,

          lineTotalCents: calculated.lineTotalCents,

          sourceJobMaterialId: null,

          position: index,
        });
      }

      const hydrated = await hydrateFullInvoicePrisma8(
        membership.organizationId,
        invoice.id,
        tx.orm,
      );

      await writeInvoiceActivityPrisma8(tx, {
        organizationId: membership.organizationId,

        customerId: hydrated.customerId,

        actorUserId: membership.userId,

        type: 'INVOICE_CREATED',

        title: 'Invoice created',

        description: `${hydrated.number} was created.`,

        metadata: {
          invoiceId: hydrated.id,

          invoiceNumber: hydrated.number,

          totalCents: hydrated.totalCents,

          balanceDueCents: hydrated.balanceDueCents,
        },
      });

      return hydrated;
    });
  }

  async updateForUser(
    clerkUserId: string,
    invoiceId: string,
    input: UpdateInvoiceDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const existing = await requireInvoiceForOrganizationPrisma8(
        membership.organizationId,
        invoiceId,
        tx.orm,
      );

      this.requireDraft(existing.status);

      const nextCustomerId = input.customerId ?? existing.customerId;

      const nextJobId =
        input.jobId !== undefined ? input.jobId : existing.jobId;

      await requireCustomerForOrganizationPrisma8(
        membership.organizationId,
        nextCustomerId,
        tx.orm,
      );

      const nextJob = nextJobId
        ? await requireJobForCustomerPrisma8(
            membership.organizationId,
            nextCustomerId,
            nextJobId,
            tx.orm,
          )
        : null;

      if (nextJob && nextJob.currency !== existing.currency) {
        throw new BadRequestException(
          'This invoice cannot be moved to a job with a different currency',
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
        const currentLineItems = await tx.orm.public.InvoiceLineItem.where({
          invoiceId,
        })
          .select('quantity', 'unitPriceCents')
          .all();

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

      const updateData: Parameters<
        ReturnType<typeof tx.orm.public.Invoice.where>['update']
      >[0] = {
        customerId: nextCustomerId,

        jobId: nextJobId,

        updatedAt: toPrisma8Timestamp(),
      };

      if (input.title !== undefined) {
        updateData.title = clean(input.title) ?? null;
      }

      if (input.notes !== undefined) {
        updateData.notes = clean(input.notes) ?? null;
      }

      if (input.terms !== undefined) {
        updateData.terms = clean(input.terms) ?? null;
      }

      if (input.issueDate !== undefined) {
        updateData.issueDate = toPrisma8Timestamp(new Date(input.issueDate));
      }

      if (input.dueDate !== undefined) {
        updateData.dueDate = input.dueDate
          ? toPrisma8Timestamp(new Date(input.dueDate))
          : null;
      }

      if (totals) {
        updateData.subtotalCents = totals.subtotalCents;

        updateData.discountCents = totals.discountCents;

        updateData.taxRate = toPrisma8Numeric(String(totals.taxRate), 7, 4);

        updateData.taxCents = totals.taxCents;

        updateData.totalCents = totals.totalCents;

        updateData.balanceDueCents = nextBalanceDueCents;
      }

      await tx.orm.public.Invoice.where({
        id: invoiceId,

        organizationId: membership.organizationId,
      }).update(updateData);

      if (input.lineItems) {
        const oldLineItems = await tx.orm.public.InvoiceLineItem.where({
          invoiceId,
        })
          .select('id')
          .all();

        for (const oldLineItem of oldLineItems) {
          await tx.orm.public.InvoiceLineItem.where({
            id: oldLineItem.id,
          }).delete();
        }

        for (let index = 0; index < input.lineItems.length; index += 1) {
          const lineItem = input.lineItems[index];

          const calculated = totals!.lineItems[index];

          await createInvoiceLineItemPrisma8(tx, {
            invoiceId,

            description: lineItem.description.trim(),

            quantity: calculated.quantity,

            unitPriceCents: calculated.unitPriceCents,

            lineTotalCents: calculated.lineTotalCents,

            sourceJobMaterialId: null,

            position: index,
          });
        }
      }

      const invoice = await hydrateFullInvoicePrisma8(
        membership.organizationId,
        invoiceId,
        tx.orm,
      );

      await writeInvoiceActivityPrisma8(tx, {
        organizationId: membership.organizationId,

        customerId: invoice.customerId,

        actorUserId: membership.userId,

        type: 'INVOICE_UPDATED',

        title: 'Invoice updated',

        description: `${invoice.number} was updated.`,

        metadata: {
          invoiceId: invoice.id,

          invoiceNumber: invoice.number,

          totalCents: invoice.totalCents,

          balanceDueCents: invoice.balanceDueCents,
        },
      });

      return invoice;
    });
  }

  async importMaterialsForUser(
    clerkUserId: string,
    invoiceId: string,
    materialIds: string[],
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const requestedMaterialIds = [
      ...new Set(
        materialIds.map((materialId) => materialId.trim()).filter(Boolean),
      ),
    ];

    if (requestedMaterialIds.length === 0) {
      throw new BadRequestException('Select at least one material to add');
    }

    return db.transaction(async (tx) => {
      const existing = await requireInvoiceForOrganizationPrisma8(
        membership.organizationId,
        invoiceId,
        tx.orm,
      );

      this.requireDraft(existing.status);

      if (!existing.jobId) {
        throw new BadRequestException(
          'Materials can only be added to an invoice linked to a job',
        );
      }

      const currentLineItems = await tx.orm.public.InvoiceLineItem.where({
        invoiceId,
      })
        .select(
          'description',
          'quantity',
          'unitPriceCents',
          'position',
          'sourceJobMaterialId',
        )
        .orderBy((model) => model.position.asc())
        .all();

      const existingMaterialIds = new Set(
        currentLineItems
          .map((lineItem) => lineItem.sourceJobMaterialId)
          .filter((materialId): materialId is string => materialId !== null),
      );

      const alreadyAdded = requestedMaterialIds.filter((materialId) =>
        existingMaterialIds.has(materialId),
      );

      if (alreadyAdded.length > 0) {
        throw new BadRequestException(
          'One or more selected materials have already been added to this invoice',
        );
      }

      /*
       * Avoid an unproven Prisma 8 IN predicate here.
       * Scope by organization/job, then preserve the
       * requested ID selection in application code.
       */
      const jobMaterials = await tx.orm.public.JobMaterial.where({
        organizationId: membership.organizationId,

        jobId: existing.jobId,
      })
        .select(
          'id',
          'name',
          'description',
          'quantity',
          'status',
          'billableUnitPriceCents',
        )
        .all();

      const requestedSet = new Set(requestedMaterialIds);

      const materials = jobMaterials.filter((material) =>
        requestedSet.has(material.id),
      );

      const materialsById = new Map(
        materials.map((material) => [material.id, material]),
      );

      const selectedMaterials = requestedMaterialIds.map((materialId) => {
        const material = materialsById.get(materialId);

        if (!material) {
          throw new NotFoundException(
            'One or more selected materials were not found for this job',
          );
        }

        if (material.status === JobMaterialStatus.CANCELLED) {
          throw new BadRequestException(
            `${material.name} is cancelled and cannot be added to an invoice`,
          );
        }

        if (material.billableUnitPriceCents === null) {
          throw new BadRequestException(
            `${material.name} does not have a customer unit price`,
          );
        }

        return material;
      });

      const importedLineItems = selectedMaterials.map((material) => {
        const billableUnitPriceCents = material.billableUnitPriceCents;

        if (billableUnitPriceCents === null) {
          throw new BadRequestException(
            `${material.name} does not have a customer unit price`,
          );
        }

        return {
          description: formatMaterialLineItemDescription(
            material.name,
            material.description,
          ),

          quantity: Number(material.quantity),

          unitPriceCents: billableUnitPriceCents,

          sourceJobMaterialId: material.id,
        };
      });

      const calculationLineItems = [
        ...currentLineItems.map((lineItem) => ({
          quantity: Number(lineItem.quantity),

          unitPriceCents: lineItem.unitPriceCents,
        })),

        ...importedLineItems.map((lineItem) => ({
          quantity: lineItem.quantity,

          unitPriceCents: lineItem.unitPriceCents,
        })),
      ];

      const totals = calculateInvoiceTotals({
        lineItems: calculationLineItems,

        discountCents: existing.discountCents,

        taxRate: Number(existing.taxRate),
      });

      const balance = calculateInvoiceBalance(
        totals.totalCents,
        existing.amountPaidCents,
      );

      const highestPosition = currentLineItems.reduce(
        (highest, lineItem) => Math.max(highest, lineItem.position),
        -1,
      );

      const firstImportedIndex = currentLineItems.length;

      for (let index = 0; index < importedLineItems.length; index += 1) {
        const lineItem = importedLineItems[index];

        const calculated = totals.lineItems[firstImportedIndex + index];

        await createInvoiceLineItemPrisma8(tx, {
          invoiceId,

          description: lineItem.description,

          quantity: calculated.quantity,

          unitPriceCents: calculated.unitPriceCents,

          lineTotalCents: calculated.lineTotalCents,

          sourceJobMaterialId: lineItem.sourceJobMaterialId,

          position: highestPosition + index + 1,
        });
      }

      await tx.orm.public.Invoice.where({
        id: invoiceId,

        organizationId: membership.organizationId,
      }).update({
        subtotalCents: totals.subtotalCents,

        discountCents: totals.discountCents,

        taxRate: toPrisma8Numeric(String(totals.taxRate), 7, 4),

        taxCents: totals.taxCents,

        totalCents: totals.totalCents,

        amountPaidCents: balance.amountPaidCents,

        balanceDueCents: balance.balanceDueCents,

        updatedAt: toPrisma8Timestamp(),
      });

      const invoice = await hydrateFullInvoicePrisma8(
        membership.organizationId,
        invoiceId,
        tx.orm,
      );

      await writeInvoiceActivityPrisma8(tx, {
        organizationId: membership.organizationId,

        customerId: invoice.customerId,

        actorUserId: membership.userId,

        type: 'INVOICE_UPDATED',

        title: 'Materials added to invoice',

        description: `${selectedMaterials.length} material${
          selectedMaterials.length === 1 ? '' : 's'
        } added to ${invoice.number}.`,

        metadata: {
          invoiceId: invoice.id,

          invoiceNumber: invoice.number,

          jobId: existing.jobId,

          materialIds: selectedMaterials.map((material) => material.id),

          materialCount: selectedMaterials.length,

          totalCents: invoice.totalCents,

          balanceDueCents: invoice.balanceDueCents,
        },
      });

      return invoice;
    });
  }

  async createFromEstimateForUser(
    clerkUserId: string,
    estimateId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const estimate = await tx.orm.public.Estimate.where({
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
          'currency',
          'subtotalCents',
          'discountCents',
          'taxRate',
          'taxCents',
          'totalCents',
        )
        .first();

      if (!estimate) {
        throw new NotFoundException('Estimate not found');
      }

      if (estimate.status !== EstimateStatus.APPROVED) {
        throw new BadRequestException(
          'Only approved estimates can be converted to invoices',
        );
      }

      const estimateLineItems = await tx.orm.public.EstimateLineItem.where({
        estimateId: estimate.id,
      })
        .select(
          'description',
          'quantity',
          'unitPriceCents',
          'lineTotalCents',
          'sourceJobMaterialId',
          'position',
        )
        .orderBy((model) => model.position.asc())
        .all();

      /*
       * Avoid relying on an unproven Prisma 8 relation
       * predicate for sourceEstimateId. Scope invoices
       * by organization and check the source ID in JS.
       */
      const organizationInvoices = await tx.orm.public.Invoice.where({
        organizationId: membership.organizationId,
      })
        .select('id', 'number', 'sourceEstimateId')
        .all();

      const existingInvoice = organizationInvoices.find(
        (invoice) => invoice.sourceEstimateId === estimate.id,
      );

      if (existingInvoice) {
        throw new BadRequestException(
          `Estimate ${estimate.number} has already been converted to invoice ${existingInvoice.number}`,
        );
      }

      await requireCustomerForOrganizationPrisma8(
        membership.organizationId,
        estimate.customerId,
        tx.orm,
      );

      if (estimate.jobId) {
        await requireJobForCustomerPrisma8(
          membership.organizationId,
          estimate.customerId,
          estimate.jobId,
          tx.orm,
        );
      }

      if (estimateLineItems.length === 0) {
        throw new BadRequestException(
          'Estimate must contain at least one line item',
        );
      }

      const estimateSourceMaterialIds = [
        ...new Set(
          estimateLineItems
            .map((lineItem) => lineItem.sourceJobMaterialId)
            .filter((materialId): materialId is string => materialId !== null),
        ),
      ];

      const validEstimateSourceMaterialIds = new Set<string>();

      if (estimateSourceMaterialIds.length > 0) {
        const scopedMaterials = await tx.orm.public.JobMaterial.where({
          organizationId: membership.organizationId,
        })
          .select('id', 'jobId')
          .all();

        const requestedMaterialIds = new Set(estimateSourceMaterialIds);

        for (const material of scopedMaterials) {
          if (!requestedMaterialIds.has(material.id)) {
            continue;
          }

          if (estimate.jobId && material.jobId !== estimate.jobId) {
            continue;
          }

          validEstimateSourceMaterialIds.add(material.id);
        }
      }

      const copiedEstimateSourceMaterialIds = new Set<string>();

      const invoiceNumber = await generateInvoiceNumberPrisma8(
        membership.organizationId,
        tx,
      );

      const now = toPrisma8Timestamp();

      const invoice = await tx.orm.public.Invoice.create({
        organizationId: membership.organizationId,

        customerId: estimate.customerId,

        jobId: estimate.jobId,

        sourceEstimateId: estimate.id,

        createdByUserId: membership.userId,

        number: invoiceNumber,

        status: InvoiceStatus.DRAFT,

        title: estimate.title,

        notes: estimate.notes,

        terms: estimate.terms,

        currency: estimate.currency,

        issueDate: now,

        dueDate: null,

        subtotalCents: estimate.subtotalCents,

        discountCents: estimate.discountCents,

        taxRate: toPrisma8Numeric(estimate.taxRate.toString(), 7, 4),

        taxCents: estimate.taxCents,

        totalCents: estimate.totalCents,

        amountPaidCents: 0,

        balanceDueCents: estimate.totalCents,

        sentAt: null,

        viewedAt: null,

        paidAt: null,

        overdueAt: null,

        voidedAt: null,

        createdAt: now,

        updatedAt: now,

        publicAccessCreatedAt: null,

        publicAccessToken: null,
      });

      for (const lineItem of estimateLineItems) {
        const sourceJobMaterialId = lineItem.sourceJobMaterialId;

        const copySourceJobMaterialId =
          sourceJobMaterialId !== null &&
          validEstimateSourceMaterialIds.has(sourceJobMaterialId) &&
          !copiedEstimateSourceMaterialIds.has(sourceJobMaterialId)
            ? sourceJobMaterialId
            : null;

        if (copySourceJobMaterialId) {
          copiedEstimateSourceMaterialIds.add(copySourceJobMaterialId);
        }

        await createInvoiceLineItemPrisma8(tx, {
          invoiceId: invoice.id,

          description: lineItem.description,

          quantity: lineItem.quantity,

          unitPriceCents: lineItem.unitPriceCents,

          lineTotalCents: lineItem.lineTotalCents,

          sourceJobMaterialId: copySourceJobMaterialId,

          position: lineItem.position,
        });
      }

      const hydrated = await hydrateFullInvoicePrisma8(
        membership.organizationId,
        invoice.id,
        tx.orm,
      );

      await writeInvoiceActivityPrisma8(tx, {
        organizationId: membership.organizationId,

        customerId: hydrated.customerId,

        actorUserId: membership.userId,

        type: 'INVOICE_CREATED',

        title: 'Invoice created from estimate',

        description: `${hydrated.number} was created from ${estimate.number}.`,

        metadata: {
          invoiceId: hydrated.id,

          invoiceNumber: hydrated.number,

          estimateId: estimate.id,

          estimateNumber: estimate.number,

          totalCents: hydrated.totalCents,

          balanceDueCents: hydrated.balanceDueCents,
        },
      });

      return hydrated;
    });
  }

  async sendForUser(
    clerkUserId: string,
    invoiceId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const invoice = await hydrateFullInvoicePrisma8(
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

    const organization = await db.orm.public.Organization.where({
      id: membership.organizationId,
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
      )
      .first();

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

    const emailSubject = `Invoice ${invoice.number} from ${organization.name}`;

    const emailHtml = this.buildInvoiceEmailHtml({
      invoice,
      organizationName: organization.name,
      businessName,
      customerName,
      publicInvoiceUrl,
    });

    const emailText = this.buildInvoiceEmailText({
      invoice,
      organizationName: organization.name,
      businessName,
      customerName,
      publicInvoiceUrl,
    });

    try {
      await this.customerCommunicationsService.sendEmail({
        organizationId: membership.organizationId,

        customerId: invoice.customerId,

        actorUserId: membership.userId,

        category: CommunicationCategory.INVOICE,

        recipientEmail: customerEmail,

        subject: emailSubject,

        htmlBody: emailHtml,

        textBody: emailText,

        invoiceId: invoice.id,

        jobId: invoice.jobId,

        estimateId: invoice.sourceEstimateId,

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
        await db.transaction(async (tx) => {
          await clearInvoicePublicAccessPrisma8(tx, {
            organizationId: membership.organizationId,

            invoiceId: invoice.id,

            token: publicAccess.token,
          });
        });
      }

      throw error;
    }

    return db.transaction(async (tx) => {
      const affected = await executeSendInvoiceCasPrisma8(
        tx,
        membership.organizationId,
        invoiceId,
      );

      if (affected !== 1) {
        const current = await tx.orm.public.Invoice.where({
          id: invoiceId,

          organizationId: membership.organizationId,
        })
          .select('status')
          .first();

        if (!current) {
          throw new NotFoundException('Invoice not found');
        }

        throw new BadRequestException(
          `Invoice cannot transition from ${current.status} to ${InvoiceStatus.SENT}`,
        );
      }

      const sentInvoice = await hydrateFullInvoicePrisma8(
        membership.organizationId,
        invoiceId,
        tx.orm,
      );

      await writeInvoiceActivityPrisma8(tx, {
        organizationId: membership.organizationId,

        customerId: sentInvoice.customerId,

        actorUserId: membership.userId,

        type: 'INVOICE_SENT',

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
      });

      return sentInvoice;
    });
  }

  async sendManualFollowUpForUser(
    clerkUserId: string,
    invoiceId: string,
    input: {
      subject: string;
      message: string;
    },
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const invoice = await hydrateFullInvoicePrisma8(
      membership.organizationId,
      invoiceId,
    );

    const eligibleStatuses: InvoiceStatus[] = [
      InvoiceStatus.SENT,
      InvoiceStatus.VIEWED,
      InvoiceStatus.PARTIALLY_PAID,
      InvoiceStatus.OVERDUE,
    ];

    if (!eligibleStatuses.includes(invoice.status)) {
      throw new BadRequestException(
        'Manual payment follow-up is only available for outstanding sent invoices',
      );
    }

    if (invoice.balanceDueCents <= 0) {
      throw new BadRequestException(
        'This invoice does not have an outstanding balance',
      );
    }

    const customerEmail = invoice.customer.email?.trim().toLowerCase();

    if (!customerEmail) {
      throw new BadRequestException(
        'Customer must have an email address before a payment follow-up can be sent',
      );
    }

    const subject = input.subject.trim();
    const message = input.message.trim();

    if (!subject) {
      throw new BadRequestException('Payment follow-up subject is required');
    }

    if (!message) {
      throw new BadRequestException('Payment follow-up message is required');
    }

    const [organization, publicAccess] = await Promise.all([
      db.orm.public.Organization.where({
        id: membership.organizationId,
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
        )
        .first(),

      db.orm.public.Invoice.where({
        id: invoice.id,

        organizationId: membership.organizationId,
      })
        .select('publicAccessToken')
        .first(),
    ]);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (!publicAccess) {
      throw new NotFoundException('Invoice not found');
    }

    if (!publicAccess.publicAccessToken) {
      throw new BadRequestException(
        'Secure invoice access is unavailable for this invoice',
      );
    }

    const publicInvoiceUrl = new URL(
      `/i/${publicAccess.publicAccessToken}`,
      this.configService.get('WEB_URL', {
        infer: true,
      }),
    ).toString();

    const customerName = [invoice.customer.firstName, invoice.customer.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    const emailHtml = this.buildInvoiceManualFollowUpHtml({
      invoice,
      organizationName: organization.name,
      customerName,
      message,
      publicInvoiceUrl,
    });

    const emailText = this.buildInvoiceManualFollowUpText({
      invoice,
      organizationName: organization.name,
      customerName,
      message,
      publicInvoiceUrl,
    });

    const pdf = await createInvoicePdf(
      this.toInvoicePdfInvoice(invoice),
      this.toInvoicePdfOrganization(organization),
    );

    const communication = await this.customerCommunicationsService.sendEmail({
      organizationId: membership.organizationId,
      customerId: invoice.customerId,
      actorUserId: membership.userId,

      category: CommunicationCategory.INVOICE,

      recipientEmail: customerEmail,
      subject,
      htmlBody: emailHtml,
      textBody: emailText,

      invoiceId: invoice.id,
      jobId: invoice.jobId,
      estimateId: invoice.sourceEstimateId,

      attachments: [
        {
          filename: sanitizePdfFilename(`${invoice.number}.pdf`),
          content: pdf,
        },
      ],

      replyTo: organization.email ?? undefined,
    });

    return {
      sent: true,
      sentAt: communication.sentAt,
    };
  }

  async viewForUser(
    clerkUserId: string,
    invoiceId: string,
    activeOrganizationId?: string,
  ) {
    return this.transitionForUser(
      clerkUserId,
      invoiceId,
      [InvoiceStatus.SENT],
      InvoiceStatus.VIEWED,
      'viewedAt',
      CustomerActivityType.INVOICE_VIEWED,
      'Invoice viewed',
      'was viewed.',
      activeOrganizationId,
    );
  }

  async markOverdueForUser(
    clerkUserId: string,
    invoiceId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const existing = await requireInvoiceForOrganizationPrisma8(
        membership.organizationId,
        invoiceId,
        tx.orm,
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

      const affected = await executeOverdueInvoiceCasPrisma8(
        tx,
        membership.organizationId,
        invoiceId,
      );

      if (affected !== 1) {
        throw new BadRequestException('Invoice could not be marked overdue');
      }

      const invoice = await hydrateFullInvoicePrisma8(
        membership.organizationId,
        invoiceId,
        tx.orm,
      );

      await writeInvoiceActivityPrisma8(tx, {
        organizationId: membership.organizationId,

        customerId: invoice.customerId,

        actorUserId: membership.userId,

        type: 'INVOICE_OVERDUE',

        title: 'Invoice overdue',

        description: `${invoice.number} was marked overdue.`,

        metadata: {
          invoiceId: invoice.id,

          invoiceNumber: invoice.number,

          balanceDueCents: invoice.balanceDueCents,
        },
      });

      return invoice;
    });
  }

  async voidForUser(
    clerkUserId: string,
    invoiceId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const existing = await requireInvoiceForOrganizationPrisma8(
        membership.organizationId,
        invoiceId,
        tx.orm,
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

      const affected = await executeVoidInvoiceCasPrisma8(
        tx,
        membership.organizationId,
        invoiceId,
      );

      if (affected !== 1) {
        throw new BadRequestException('Invoice could not be voided');
      }

      const invoice = await hydrateFullInvoicePrisma8(
        membership.organizationId,
        invoiceId,
        tx.orm,
      );

      await writeInvoiceActivityPrisma8(tx, {
        organizationId: membership.organizationId,

        customerId: invoice.customerId,

        actorUserId: membership.userId,

        type: 'INVOICE_VOIDED',

        title: 'Invoice voided',

        description: `${invoice.number} was voided.`,

        metadata: {
          invoiceId: invoice.id,

          invoiceNumber: invoice.number,

          totalCents: invoice.totalCents,
        },
      });

      return invoice;
    });
  }

  async recordPaymentForUser(
    clerkUserId: string,
    invoiceId: string,
    input: RecordPaymentDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const invoice = await requireInvoiceForOrganizationPrisma8(
        membership.organizationId,
        invoiceId,
        tx.orm,
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

      const payment = await createPaymentPrisma8(tx, {
        organizationId: membership.organizationId,

        customerId: invoice.customerId,

        invoiceId: invoice.id,

        recordedByUserId: membership.userId,

        method: input.method,

        currency: invoice.currency,

        amountCents: input.amountCents,

        reference: clean(input.reference) ?? null,

        notes: clean(input.notes) ?? null,

        receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
      });

      const updatedInvoice = await this.recalculateInvoicePaymentState(
        membership.organizationId,
        invoiceId,
        tx,
      );

      await writeInvoiceActivityPrisma8(tx, {
        organizationId: membership.organizationId,

        customerId: updatedInvoice.customerId,

        actorUserId: membership.userId,

        type: 'PAYMENT_RECEIVED',

        title: 'Payment received',

        description: `${formatMoneyForActivity(
          payment.amountCents,
          updatedInvoice.currency,
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
      });

      if (updatedInvoice.status === InvoiceStatus.PAID) {
        await writeInvoiceActivityPrisma8(tx, {
          organizationId: membership.organizationId,

          customerId: updatedInvoice.customerId,

          actorUserId: membership.userId,

          type: 'INVOICE_PAID',

          title: 'Invoice paid',

          description: `${updatedInvoice.number} was paid in full.`,

          metadata: {
            invoiceId: updatedInvoice.id,

            invoiceNumber: updatedInvoice.number,

            totalCents: updatedInvoice.totalCents,
          },
        });
      } else {
        await writeInvoiceActivityPrisma8(tx, {
          organizationId: membership.organizationId,

          customerId: updatedInvoice.customerId,

          actorUserId: membership.userId,

          type: 'INVOICE_PARTIALLY_PAID',

          title: 'Invoice partially paid',

          description: `${updatedInvoice.number} has a remaining balance.`,

          metadata: {
            invoiceId: updatedInvoice.id,

            invoiceNumber: updatedInvoice.number,

            amountPaidCents: updatedInvoice.amountPaidCents,

            balanceDueCents: updatedInvoice.balanceDueCents,
          },
        });
      }

      return updatedInvoice;
    });
  }

  async voidPaymentForUser(
    clerkUserId: string,
    invoiceId: string,
    paymentId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      await requireInvoiceForOrganizationPrisma8(
        membership.organizationId,
        invoiceId,
        tx.orm,
      );

      const payment = await tx.orm.public.Payment.where({
        id: paymentId,

        invoiceId,

        organizationId: membership.organizationId,
      })
        .select('id', 'customerId', 'status', 'amountCents')
        .first();

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.status === PaymentStatus.VOIDED) {
        throw new BadRequestException('Payment is already voided');
      }

      const affected = await executeVoidPaymentCasPrisma8(tx, {
        organizationId: membership.organizationId,

        invoiceId,

        paymentId,
      });

      if (affected !== 1) {
        throw new BadRequestException('Payment could not be voided');
      }

      const updatedInvoice = await this.recalculateInvoicePaymentState(
        membership.organizationId,
        invoiceId,
        tx,
      );

      await writeInvoiceActivityPrisma8(tx, {
        organizationId: membership.organizationId,

        customerId: updatedInvoice.customerId,

        actorUserId: membership.userId,

        type: 'PAYMENT_VOIDED',

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
      });

      return updatedInvoice;
    });
  }

  private async recalculateInvoicePaymentState(
    organizationId: string,
    invoiceId: string,
    tx: DatabaseTransaction,
  ) {
    const invoice = await requireInvoiceForOrganizationPrisma8(
      organizationId,
      invoiceId,
      tx.orm,
    );

    const amountPaidCents = await sumRecordedPaymentsPrisma8(
      tx,
      organizationId,
      invoiceId,
    );

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

    await updateInvoicePaymentStatePrisma8(tx, {
      organizationId,
      invoiceId,

      amountPaidCents: balance.amountPaidCents,

      balanceDueCents: balance.balanceDueCents,

      nextStatus,

      paidAt:
        nextStatus === InvoiceStatus.PAID ? (invoice.paidAt ?? now) : null,
    });

    return hydrateFullInvoicePrisma8(organizationId, invoiceId, tx.orm);
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

  private requireDraft(status: InvoiceStatus) {
    if (status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be edited');
    }
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }

  private async ensurePublicAccessForDraft(
    organizationId: string,
    invoiceId: string,
  ): Promise<{
    token: string;
    created: boolean;
  }> {
    const existing = await db.orm.public.Invoice.where({
      id: invoiceId,

      organizationId,
    })
      .select('status', 'publicAccessToken')
      .first();

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
        const affected = await db.transaction(async (tx) =>
          reserveInvoicePublicAccessPrisma8(tx, {
            organizationId,
            invoiceId,
            token,
          }),
        );

        if (affected === 1) {
          return {
            token,
            created: true,
          };
        }

        const current = await db.orm.public.Invoice.where({
          id: invoiceId,

          organizationId,
        })
          .select('status', 'publicAccessToken')
          .first();

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
        /*
         * Each reservation attempt uses its own short
         * transaction. A unique-token violation aborts
         * only that transaction; the next attempt starts
         * clean.
         */
        if (isPrisma8UniqueViolation(error)) {
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
    invoice: HydratedInvoicePrisma8,
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

  private buildInvoiceManualFollowUpHtml({
    invoice,
    organizationName,
    customerName,
    message,
    publicInvoiceUrl,
  }: {
    invoice: HydratedInvoicePrisma8;
    organizationName: string;
    customerName: string;
    message: string;
    publicInvoiceUrl: string;
  }) {
    const escapedOrganizationName = escapeHtml(organizationName);

    const escapedCustomerName = escapeHtml(customerName || 'Customer');

    const escapedInvoiceNumber = escapeHtml(invoice.number);

    const escapedPublicInvoiceUrl = escapeHtml(publicInvoiceUrl);

    const escapedMessage = escapeHtml(message)
      .replaceAll('\r\n', '\n')
      .replaceAll('\r', '\n')
      .replaceAll('\n', '<br>');

    const balanceDue = escapeHtml(
      formatMoneyForEmail(invoice.balanceDueCents, invoice.currency),
    );

    const dueDate = invoice.dueDate
      ? escapeHtml(formatDateForEmail(invoice.dueDate))
      : 'No due date';

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
                      <div style="font-size:14px;color:#71717a;margin-bottom:8px;">
                        ${escapedOrganizationName}
                      </div>

                      <h1 style="margin:0;font-size:24px;line-height:1.3;">
                        Invoice ${escapedInvoiceNumber}
                      </h1>

                      <p style="margin:28px 0 0;line-height:1.6;">
                        Hello ${escapedCustomerName},
                      </p>

                      <p style="margin:16px 0 0;line-height:1.6;color:#3f3f46;">
                        ${escapedMessage}
                      </p>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border-collapse:collapse;">
                        <tr>
                          <td style="padding:12px 0;border-bottom:1px solid #e4e4e7;color:#71717a;">
                            Balance due
                          </td>

                          <td align="right" style="padding:12px 0;border-bottom:1px solid #e4e4e7;font-weight:700;">
                            ${balanceDue}
                          </td>
                        </tr>

                        <tr>
                          <td style="padding:12px 0;color:#71717a;">
                            Due date
                          </td>

                          <td align="right" style="padding:12px 0;font-weight:600;">
                            ${dueDate}
                          </td>
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

  private buildInvoiceManualFollowUpText({
    invoice,
    organizationName,
    customerName,
    message,
    publicInvoiceUrl,
  }: {
    invoice: HydratedInvoicePrisma8;
    organizationName: string;
    customerName: string;
    message: string;
    publicInvoiceUrl: string;
  }) {
    return [
      `Hello ${customerName || 'Customer'},`,
      '',
      message,
      '',
      `Invoice: ${invoice.number}`,
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
      `A PDF copy of invoice ${invoice.number} is attached for reference.`,
      '',
      `Please contact ${organizationName} if you have any questions about this invoice.`,
    ].join('\n');
  }

  private buildInvoiceEmailHtml({
    invoice,
    organizationName,
    businessName,
    customerName,
    publicInvoiceUrl,
  }: {
    invoice: HydratedInvoicePrisma8;
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
    invoice: HydratedInvoicePrisma8;
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
    activityType: InvoiceActivityType,
    activityTitle: string,
    activityDescription: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const existing = await requireInvoiceForOrganizationPrisma8(
        membership.organizationId,
        invoiceId,
        tx.orm,
      );

      if (!allowedStatuses.includes(existing.status)) {
        throw new BadRequestException(
          `Invoice cannot transition from ${existing.status} to ${nextStatus}`,
        );
      }

      const affected = await executeInvoiceTransitionCasPrisma8(tx, {
        organizationId: membership.organizationId,

        invoiceId,

        allowedStatuses,

        nextStatus,

        timestampField,
      });

      if (affected !== 1) {
        const current = await tx.orm.public.Invoice.where({
          id: invoiceId,

          organizationId: membership.organizationId,
        })
          .select('status')
          .first();

        if (!current) {
          throw new NotFoundException('Invoice not found');
        }

        throw new BadRequestException(
          `Invoice cannot transition from ${current.status} to ${nextStatus}`,
        );
      }

      const invoice = await hydrateFullInvoicePrisma8(
        membership.organizationId,
        invoiceId,
        tx.orm,
      );

      await writeInvoiceActivityPrisma8(tx, {
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
      });

      return invoice;
    });
  }
}

function formatMoneyForEmail(cents: number, currency: string) {
  return formatCurrencyAmount(cents, currency, 'en-CA');
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

function formatMaterialLineItemDescription(
  name: string,
  description: string | null,
) {
  const cleanName = name.trim();
  const cleanDescription = description?.trim();

  if (!cleanDescription) {
    return cleanName;
  }

  return `${cleanName} — ${cleanDescription}`;
}

function formatMoneyForActivity(cents: number, currency: string) {
  return formatCurrencyAmount(cents, currency, 'en-CA');
}
