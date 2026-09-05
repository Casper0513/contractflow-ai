// apps/api/src/job-costs/job-costs.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import {
  db,
  fromPrisma8Timestamp,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { OrganizationMembershipService } from '../auth/organization-membership.service';

import type { CreateJobCostDto } from './dto/create-job-cost.dto';
import type { UpdateJobCostDto } from './dto/update-job-cost.dto';

const REVENUE_INVOICE_STATUSES = new Set([
  'SENT',
  'VIEWED',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
]);

type JobCostCategory =
  | 'MATERIAL'
  | 'LABOR'
  | 'SUBCONTRACTOR'
  | 'EQUIPMENT'
  | 'PERMIT'
  | 'TRAVEL'
  | 'OTHER';

type OrmSource = typeof db.orm;

type JobCostRecord = {
  id: string;
  organizationId: string;
  jobId: string;
  createdByUserId: string | null;
  category: JobCostCategory;
  description: string;
  amountCents: number;
  incurredAt: Parameters<typeof fromPrisma8Timestamp>[0];
  vendor: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: Parameters<typeof fromPrisma8Timestamp>[0];
  updatedAt: Parameters<typeof fromPrisma8Timestamp>[0];
};

@Injectable()
export class JobCostsService {
  constructor(
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

    const costs = await db.orm.public.JobCost.where({
      organizationId: membership.organizationId,
      jobId,
    })
      .select(
        'id',
        'organizationId',
        'jobId',
        'createdByUserId',
        'category',
        'description',
        'amountCents',
        'incurredAt',
        'vendor',
        'reference',
        'notes',
        'createdAt',
        'updatedAt',
      )
      .orderBy([
        (model) => model.incurredAt.desc(),
        (model) => model.createdAt.desc(),
      ])
      .all();

    return Promise.all(costs.map((cost) => this.hydrateCost(db.orm, cost)));
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

    const job = await db.orm.public.Job.where({
      id: jobId,
      organizationId: membership.organizationId,
    })
      .select('id', 'currency', 'budgetCents')
      .first();

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const [costs, timeEntries, invoices, payments] = await Promise.all([
      db.orm.public.JobCost.where({
        organizationId: membership.organizationId,
        jobId,
      })
        .select('category', 'amountCents')
        .all(),

      db.orm.public.JobTimeEntry.where({
        organizationId: membership.organizationId,
        jobId,
      })
        .select('endedAt', 'laborCostCents')
        .all(),

      db.orm.public.Invoice.where({
        organizationId: membership.organizationId,
        jobId,
        currency: job.currency,
      })
        .select('id', 'status', 'totalCents')
        .all(),

      db.orm.public.Payment.where({
        organizationId: membership.organizationId,
        currency: job.currency,
        status: 'RECORDED',
      })
        .select('invoiceId', 'amountCents')
        .all(),
    ]);

    const categoryTotals = createEmptyCategoryTotals();

    for (const cost of costs) {
      categoryTotals[cost.category] += cost.amountCents;
    }

    for (const timeEntry of timeEntries) {
      if (timeEntry.endedAt !== null) {
        categoryTotals.LABOR += timeEntry.laborCostCents;
      }
    }

    const revenueInvoices = invoices.filter((invoice) =>
      REVENUE_INVOICE_STATUSES.has(invoice.status),
    );

    const validInvoiceIds = new Set(
      invoices
        .filter((invoice) => invoice.status !== 'VOIDED')
        .map((invoice) => invoice.id),
    );

    const actualCostCents = Object.values(categoryTotals).reduce(
      (total, amount) => total + amount,
      0,
    );

    const invoicedRevenueCents = revenueInvoices.reduce(
      (total, invoice) => total + invoice.totalCents,
      0,
    );

    const collectedRevenueCents = payments
      .filter((payment) => validInvoiceIds.has(payment.invoiceId))
      .reduce((total, payment) => total + payment.amountCents, 0);

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

    return db.transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx.orm,
      );

      const now = toPrisma8Timestamp();

      const incurredAt = input.incurredAt
        ? toPrisma8Timestamp(new Date(input.incurredAt))
        : now;

      const cost = await tx.orm.public.JobCost.create({
        organizationId: membership.organizationId,
        jobId,
        createdByUserId: membership.userId,
        category: input.category,
        description: input.description.trim(),
        amountCents: input.amountCents,
        incurredAt,
        vendor: cleanNullable(input.vendor),
        reference: cleanNullable(input.reference),
        notes: cleanNullable(input.notes),
        createdAt: now,
        updatedAt: now,
      });

      await tx.orm.public.CustomerActivity.create({
        organizationId: membership.organizationId,
        customerId: job.customerId,
        actorUserId: membership.userId,
        _type: 'JOB_COST_CREATED',
        title: 'Job cost added',
        description: `${cost.description} was added to ${job.name}.`,
        metadata: {
          jobId,
          jobName: job.name,
          costId: cost.id,
          category: cost.category,
          amountCents: cost.amountCents,
        },
      });

      return this.hydrateCost(tx.orm, cost);
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

    return db.transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx.orm,
      );

      const existing = await this.requireCostForJob(
        membership.organizationId,
        jobId,
        costId,
        tx.orm,
      );

      const existingIncurredAt = fromPrisma8Timestamp(existing.incurredAt);

      const nextIncurredAt =
        input.incurredAt !== undefined
          ? new Date(input.incurredAt)
          : existingIncurredAt;

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

        incurredAt: nextIncurredAt,

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
        existingIncurredAt,
        nextValues.incurredAt,
      );

      addChange(changes, 'vendor', existing.vendor, nextValues.vendor);

      addChange(changes, 'reference', existing.reference, nextValues.reference);

      addChange(changes, 'notes', existing.notes, nextValues.notes);

      await tx.orm.public.JobCost.where({
        id: costId,
      }).update({
        category: nextValues.category,
        description: nextValues.description,
        amountCents: nextValues.amountCents,
        incurredAt: toPrisma8Timestamp(nextValues.incurredAt),
        vendor: nextValues.vendor,
        reference: nextValues.reference,
        notes: nextValues.notes,
        updatedAt: toPrisma8Timestamp(),
      });

      const cost = await this.requireCostForJob(
        membership.organizationId,
        jobId,
        costId,
        tx.orm,
      );

      if (Object.keys(changes).length > 0) {
        await tx.orm.public.CustomerActivity.create({
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          _type: 'JOB_COST_UPDATED',
          title: 'Job cost updated',
          description: `${cost.description} was updated on ${job.name}.`,
          metadata: {
            jobId,
            jobName: job.name,
            costId: cost.id,
            changes,
          },
        });
      }

      return this.hydrateCost(tx.orm, cost);
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

    return db.transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx.orm,
      );

      const existing = await this.requireCostForJob(
        membership.organizationId,
        jobId,
        costId,
        tx.orm,
      );

      await tx.orm.public.JobCost.where({
        id: costId,
      }).delete();

      await tx.orm.public.CustomerActivity.create({
        organizationId: membership.organizationId,
        customerId: job.customerId,
        actorUserId: membership.userId,
        _type: 'JOB_COST_DELETED',
        title: 'Job cost deleted',
        description: `${existing.description} was removed from ${job.name}.`,
        metadata: {
          jobId,
          jobName: job.name,
          costId: existing.id,
          category: existing.category,
          amountCents: existing.amountCents,
        },
      });

      return {
        success: true,
      };
    });
  }

  private async requireJobForOrganization(
    organizationId: string,
    jobId: string,
    orm: OrmSource = db.orm,
  ) {
    const job = await orm.public.Job.where({
      id: jobId,
      organizationId,
    })
      .select('id', 'customerId', 'name')
      .first();

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  private async requireCostForJob(
    organizationId: string,
    jobId: string,
    costId: string,
    orm: OrmSource = db.orm,
  ) {
    const cost = await orm.public.JobCost.where({
      id: costId,
      jobId,
      organizationId,
    })
      .select(
        'id',
        'organizationId',
        'jobId',
        'createdByUserId',
        'category',
        'description',
        'amountCents',
        'incurredAt',
        'vendor',
        'reference',
        'notes',
        'createdAt',
        'updatedAt',
      )
      .first();

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

  private async hydrateCost(orm: OrmSource, cost: JobCostRecord) {
    const createdBy =
      cost.createdByUserId === null
        ? null
        : await orm.public.User.where({
            id: cost.createdByUserId,
          })
            .select('id', 'firstName', 'lastName', 'email')
            .first();

    return {
      id: cost.id,
      organizationId: cost.organizationId,
      jobId: cost.jobId,
      createdByUserId: cost.createdByUserId,
      category: cost.category,
      description: cost.description,
      amountCents: cost.amountCents,

      incurredAt: fromPrisma8Timestamp(cost.incurredAt),

      vendor: cost.vendor,
      reference: cost.reference,
      notes: cost.notes,

      createdAt: fromPrisma8Timestamp(cost.createdAt),

      updatedAt: fromPrisma8Timestamp(cost.updatedAt),

      createdBy,
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

function cleanNullable(value: string | null | undefined): string | null {
  const result = value?.trim();

  return result || null;
}

function createEmptyCategoryTotals(): Record<JobCostCategory, number> {
  return {
    MATERIAL: 0,
    LABOR: 0,
    SUBCONTRACTOR: 0,
    EQUIPMENT: 0,
    PERMIT: 0,
    TRAVEL: 0,
    OTHER: 0,
  };
}
