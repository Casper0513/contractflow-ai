// apps/api/src/job-costs/job-costs.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CustomerActivityType,
  InvoiceStatus,
  JobCostCategory,
  PaymentStatus,
  Prisma,
  prisma,
} from '@contractflow/db';

import { OrganizationMembershipService } from '../auth/organization-membership.service';

import { ActivityService } from '../activity/activity.service';
import type { CreateJobCostDto } from './dto/create-job-cost.dto';
import type { UpdateJobCostDto } from './dto/update-job-cost.dto';

const REVENUE_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.VIEWED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.PAID,
  InvoiceStatus.OVERDUE,
];

@Injectable()
export class JobCostsService {
  constructor(
    private readonly activityService: ActivityService,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async listForJobForUser(
    clerkUserId: string,
    jobId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    await this.requireJobForOrganization(membership.organizationId, jobId);

    return prisma.jobCost.findMany({
      where: {
        organizationId: membership.organizationId,
        jobId,
      },
      orderBy: [
        {
          incurredAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
      select: this.costSelect(),
    });
  }

  async getSummaryForJobForUser(
    clerkUserId: string,
    jobId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        organizationId: membership.organizationId,
      },
      select: {
        id: true,
        currency: true,
        budgetCents: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const [costsByCategory, timeEntryLabor, invoiced, collected] =
      await Promise.all([
        prisma.jobCost.groupBy({
          by: ['category'],
          where: {
            organizationId: membership.organizationId,
            jobId,
          },
          _sum: {
            amountCents: true,
          },
        }),

        prisma.jobTimeEntry.aggregate({
          where: {
            organizationId: membership.organizationId,
            jobId,
            endedAt: {
              not: null,
            },
          },
          _sum: {
            laborCostCents: true,
          },
        }),

        prisma.invoice.aggregate({
          where: {
            organizationId: membership.organizationId,
            jobId,
            currency: job.currency,
            status: {
              in: REVENUE_INVOICE_STATUSES,
            },
          },
          _sum: {
            totalCents: true,
          },
        }),

        prisma.payment.aggregate({
          where: {
            organizationId: membership.organizationId,
            currency: job.currency,
            status: PaymentStatus.RECORDED,
            invoice: {
              jobId,
              status: {
                not: InvoiceStatus.VOIDED,
              },
            },
          },
          _sum: {
            amountCents: true,
          },
        }),
      ]);

    const categoryTotals = createEmptyCategoryTotals();

    for (const result of costsByCategory) {
      categoryTotals[result.category] = result._sum.amountCents ?? 0;
    }

    const timeEntryLaborCents = timeEntryLabor._sum.laborCostCents ?? 0;

    categoryTotals[JobCostCategory.LABOR] += timeEntryLaborCents;

    const actualCostCents = Object.values(categoryTotals).reduce(
      (total, amount) => total + amount,
      0,
    );

    const invoicedRevenueCents = invoiced._sum.totalCents ?? 0;

    const collectedRevenueCents = collected._sum.amountCents ?? 0;

    const grossProfitCents = invoicedRevenueCents - actualCostCents;

    const grossMarginPercent =
      invoicedRevenueCents > 0
        ? (grossProfitCents / invoicedRevenueCents) * 100
        : null;

    const budgetVarianceCents =
      job.budgetCents !== null ? job.budgetCents - actualCostCents : null;

    return {
      jobId: job.id,
      currency: job.currency,

      budgetCents: job.budgetCents,

      actualCostCents,

      budgetVarianceCents,

      invoicedRevenueCents,

      collectedRevenueCents,

      grossProfitCents,

      grossMarginPercent,

      categoryTotals,
    };
  }

  async createForUser(
    clerkUserId: string,
    jobId: string,
    input: CreateJobCostDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const cost = await tx.jobCost.create({
        data: {
          organizationId: membership.organizationId,
          jobId,
          createdByUserId: membership.userId,

          category: input.category,

          description: input.description.trim(),

          amountCents: input.amountCents,

          incurredAt: input.incurredAt ? new Date(input.incurredAt) : undefined,

          vendor: clean(input.vendor),
          reference: clean(input.reference),
          notes: clean(input.notes),
        },
        select: this.costSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,

          type: CustomerActivityType.JOB_COST_CREATED,

          title: 'Job cost added',

          description: `${cost.description} was added to ${job.name}.`,

          metadata: {
            jobId,
            jobName: job.name,
            costId: cost.id,
            category: cost.category,
            amountCents: cost.amountCents,
          },
        },
        tx,
      );

      return cost;
    });
  }

  async updateForUser(
    clerkUserId: string,
    jobId: string,
    costId: string,
    input: UpdateJobCostDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const existing = await this.requireCostForJob(
        membership.organizationId,
        jobId,
        costId,
        tx,
      );

      const nextValues = {
        category:
          input.category !== undefined ? input.category : existing.category,

        description:
          input.description !== undefined
            ? input.description.trim()
            : existing.description,

        amountCents:
          input.amountCents !== undefined
            ? input.amountCents
            : existing.amountCents,

        incurredAt:
          input.incurredAt !== undefined
            ? new Date(input.incurredAt)
            : existing.incurredAt,

        vendor:
          input.vendor !== undefined
            ? cleanNullable(input.vendor)
            : existing.vendor,

        reference:
          input.reference !== undefined
            ? cleanNullable(input.reference)
            : existing.reference,

        notes:
          input.notes !== undefined
            ? cleanNullable(input.notes)
            : existing.notes,
      };

      const changes: CostChangeMap = {};

      addChange(changes, 'category', existing.category, nextValues.category);

      addChange(
        changes,
        'description',
        existing.description,
        nextValues.description,
      );

      addChange(
        changes,
        'amountCents',
        String(existing.amountCents),
        String(nextValues.amountCents),
      );

      addDateChange(
        changes,
        'incurredAt',
        existing.incurredAt,
        nextValues.incurredAt,
      );

      addChange(changes, 'vendor', existing.vendor, nextValues.vendor);

      addChange(changes, 'reference', existing.reference, nextValues.reference);

      addChange(changes, 'notes', existing.notes, nextValues.notes);

      const cost = await tx.jobCost.update({
        where: {
          id: costId,
        },
        data: nextValues,
        select: this.costSelect(),
      });

      if (Object.keys(changes).length > 0) {
        await this.activityService.recordCustomerActivity(
          {
            organizationId: membership.organizationId,
            customerId: job.customerId,
            actorUserId: membership.userId,

            type: CustomerActivityType.JOB_COST_UPDATED,

            title: 'Job cost updated',

            description: `${cost.description} was updated on ${job.name}.`,

            metadata: {
              jobId,
              jobName: job.name,
              costId: cost.id,
              changes,
            },
          },
          tx,
        );
      }

      return cost;
    });
  }

  async deleteForUser(
    clerkUserId: string,
    jobId: string,
    costId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const existing = await this.requireCostForJob(
        membership.organizationId,
        jobId,
        costId,
        tx,
      );

      await tx.jobCost.delete({
        where: {
          id: costId,
        },
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,

          type: CustomerActivityType.JOB_COST_DELETED,

          title: 'Job cost deleted',

          description: `${existing.description} was removed from ${job.name}.`,

          metadata: {
            jobId,
            jobName: job.name,
            costId: existing.id,
            category: existing.category,
            amountCents: existing.amountCents,
          },
        },
        tx,
      );

      return {
        success: true,
      };
    });
  }

  private async requireJobForOrganization(
    organizationId: string,
    jobId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const job = await client.job.findFirst({
      where: {
        id: jobId,
        organizationId,
      },
      select: {
        id: true,
        customerId: true,
        name: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  private async requireCostForJob(
    organizationId: string,
    jobId: string,
    costId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const cost = await client.jobCost.findFirst({
      where: {
        id: costId,
        jobId,
        organizationId,
      },
      select: {
        id: true,
        category: true,
        description: true,
        amountCents: true,
        incurredAt: true,
        vendor: true,
        reference: true,
        notes: true,
      },
    });

    if (!cost) {
      throw new NotFoundException('Job cost not found');
    }

    return cost;
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }

  private costSelect(): Prisma.JobCostSelect {
    return {
      id: true,
      organizationId: true,
      jobId: true,
      createdByUserId: true,

      category: true,

      description: true,
      amountCents: true,

      incurredAt: true,

      vendor: true,
      reference: true,
      notes: true,

      createdAt: true,
      updatedAt: true,

      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    };
  }
}

type CostChangeMap = Record<
  string,
  {
    oldValue: string | null;
    newValue: string | null;
  }
>;

function addChange(
  changes: CostChangeMap,
  field: string,
  oldValue: string | null,
  newValue: string | null,
) {
  if (oldValue === newValue) {
    return;
  }

  changes[field] = {
    oldValue,
    newValue,
  };
}

function addDateChange(
  changes: CostChangeMap,
  field: string,
  oldValue: Date,
  newValue: Date,
) {
  addChange(changes, field, oldValue.toISOString(), newValue.toISOString());
}

function clean(value: string | undefined): string | undefined {
  const result = value?.trim();

  return result || undefined;
}

function cleanNullable(value: string | null | undefined): string | null {
  const result = value?.trim();

  return result || null;
}

function createEmptyCategoryTotals(): Record<JobCostCategory, number> {
  return {
    [JobCostCategory.MATERIAL]: 0,
    [JobCostCategory.LABOR]: 0,
    [JobCostCategory.SUBCONTRACTOR]: 0,
    [JobCostCategory.EQUIPMENT]: 0,
    [JobCostCategory.PERMIT]: 0,
    [JobCostCategory.TRAVEL]: 0,
    [JobCostCategory.OTHER]: 0,
  };
}
