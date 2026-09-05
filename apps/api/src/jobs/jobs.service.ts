import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstimateStatus,
  JobPriority,
  JobScheduleStatus,
  JobStatus,
  JobTaskStatus,
} from '@contractflow/db';
import {
  type DatabaseTransaction,
  db,
  fromPrisma8Timestamp,
  prisma8TextParam,
  prisma8TimestampParam,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { OrganizationMembershipService } from '../auth/organization-membership.service';
import type { CreateJobDto } from './dto/create-job.dto';
import type { UpdateJobDto } from './dto/update-job.dto';

type OrmSource = typeof db.orm;

type Prisma8Timestamp = ReturnType<typeof toPrisma8Timestamp>;

type CustomerActivityCreateInput = Parameters<
  DatabaseTransaction['orm']['public']['CustomerActivity']['create']
>[0];

type CustomerActivityMetadata = CustomerActivityCreateInput['metadata'];

type JobRow = {
  id: string;
  organizationId: string;
  customerId: string;
  createdByUserId: string | null;

  name: string;
  description: string | null;

  status:
    | 'LEAD'
    | 'ESTIMATING'
    | 'APPROVED'
    | 'SCHEDULED'
    | 'IN_PROGRESS'
    | 'ON_HOLD'
    | 'COMPLETED'
    | 'CANCELLED';

  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;

  startDate: Prisma8Timestamp | null;

  endDate: Prisma8Timestamp | null;

  currency: string;
  budgetCents: number | null;

  archivedAt: Prisma8Timestamp | null;

  createdAt: Prisma8Timestamp;

  updatedAt: Prisma8Timestamp;
};

type JobChangeMap = Record<
  string,
  {
    oldValue: string | number | null;

    newValue: string | number | null;
  }
>;

const ACTIVE_JOB_STATUSES = new Set<string>([
  JobStatus.APPROVED,
  JobStatus.SCHEDULED,
  JobStatus.IN_PROGRESS,
]);

const ACTIVE_SCHEDULE_STATUSES = new Set<string>([
  JobScheduleStatus.SCHEDULED,
  JobScheduleStatus.IN_PROGRESS,
]);

const INACTIVE_TASK_STATUSES = new Set<string>([
  JobTaskStatus.COMPLETED,
  JobTaskStatus.CANCELLED,
]);

const PRIORITY_RANK: Record<string, number> = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  URGENT: 3,
};

@Injectable()
export class JobsService {
  constructor(
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async listForUser(
    clerkUserId: string,
    includeArchived = false,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const query = db.orm.public.Job.where(
      includeArchived
        ? {
            organizationId: membership.organizationId,
          }
        : {
            organizationId: membership.organizationId,

            archivedAt: null,
          },
    )
      .select(...JOB_FIELDS)
      .orderBy((model) => model.createdAt.desc());

    const jobs = await query.all();

    return Promise.all(jobs.map((job) => this.hydrateJob(db.orm, job)));
  }

  async listDispatchBacklogForUser(
    clerkUserId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const jobs = await db.orm.public.Job.where({
      organizationId: membership.organizationId,

      archivedAt: null,
    })
      .select(...JOB_FIELDS)
      .all();

    const candidates = jobs.filter((job) =>
      ACTIVE_JOB_STATUSES.has(job.status),
    );

    const backlog: JobRow[] = [];

    for (const job of candidates) {
      const schedules = await db.orm.public.JobSchedule.where({
        organizationId: membership.organizationId,

        jobId: job.id,
      })
        .select('id', 'status')
        .all();

      const hasActiveSchedule = schedules.some((schedule) =>
        ACTIVE_SCHEDULE_STATUSES.has(schedule.status),
      );

      if (!hasActiveSchedule) {
        backlog.push(job);
      }
    }

    backlog.sort(compareDispatchJobs);

    return Promise.all(backlog.map((job) => this.hydrateJob(db.orm, job)));
  }

  async listForCustomerForUser(
    clerkUserId: string,
    customerId: string,
    includeArchived = false,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const customer = await db.orm.public.Customer.where({
      id: customerId,

      organizationId: membership.organizationId,
    })
      .select('id')
      .first();

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const query = db.orm.public.Job.where(
      includeArchived
        ? {
            organizationId: membership.organizationId,

            customerId,
          }
        : {
            organizationId: membership.organizationId,

            customerId,

            archivedAt: null,
          },
    )
      .select(...JOB_FIELDS)
      .orderBy([
        (model) => model.archivedAt.asc(),

        (model) => model.createdAt.desc(),
      ]);

    const jobs = await query.all();

    return Promise.all(jobs.map((job) => this.hydrateJob(db.orm, job)));
  }

  async getByIdForUser(
    clerkUserId: string,
    jobId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const job = await this.findJobRow(db.orm, membership.organizationId, jobId);

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return this.hydrateJob(db.orm, job);
  }

  async listActivityForUser(
    clerkUserId: string,
    jobId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const job = await this.requireJobForOrganization(
      membership.organizationId,
      jobId,
    );

    const activities = await db.orm.public.CustomerActivity.where({
      organizationId: membership.organizationId,

      customerId: job.customerId,
    })
      .select(
        'id',
        '_type',
        'title',
        'description',
        'metadata',
        'createdAt',
        'actorUserId',
      )
      .orderBy((model) => model.createdAt.desc())
      .all();

    const matching = activities.filter((activity) =>
      metadataHasJobId(activity.metadata, job.id),
    );

    return Promise.all(
      matching.map(async (activity) => {
        const actor =
          activity.actorUserId === null
            ? null
            : await db.orm.public.User.where({
                id: activity.actorUserId,
              })
                .select('id', 'firstName', 'lastName', 'email')
                .first();

        return {
          id: activity.id,

          type: activity._type,

          title: activity.title,

          description: activity.description,

          metadata: activity.metadata,

          createdAt: fromPrisma8Timestamp(activity.createdAt),

          actor,
        };
      }),
    );
  }

  async createForUser(
    clerkUserId: string,
    input: CreateJobDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const [customer, organization] = await Promise.all([
        tx.orm.public.Customer.where({
          id: input.customerId,

          organizationId: membership.organizationId,
        })
          .select('id')
          .first(),

        tx.orm.public.Organization.where({
          id: membership.organizationId,
        })
          .select('currency')
          .first(),
      ]);

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      const now = toPrisma8Timestamp();

      const created = await tx.orm.public.Job.create({
        organizationId: membership.organizationId,

        customerId: input.customerId,

        createdByUserId: membership.userId,

        name: input.name.trim(),

        description: clean(input.description) ?? null,

        status: input.status,

        priority: input.priority,

        addressLine1: clean(input.addressLine1) ?? null,

        addressLine2: clean(input.addressLine2) ?? null,

        city: clean(input.city) ?? null,

        province: clean(input.province) ?? null,

        postalCode: clean(input.postalCode) ?? null,

        country: clean(input.country) ?? 'CA',

        startDate: input.startDate
          ? toPrisma8Timestamp(new Date(input.startDate))
          : null,

        endDate: input.endDate
          ? toPrisma8Timestamp(new Date(input.endDate))
          : null,

        currency: organization.currency,

        budgetCents: input.budgetCents ?? null,

        archivedAt: null,

        createdAt: now,

        updatedAt: now,
      });

      await this.createActivity(tx, {
        organizationId: membership.organizationId,

        customerId: created.customerId,

        actorUserId: membership.userId,

        type: 'JOB_CREATED',

        title: 'Job created',

        description: `${created.name} was created.`,

        metadata: {
          jobId: created.id,

          jobName: created.name,
        },
      });

      return this.hydrateJob(tx.orm, created);
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
          'currency',
          'totalCents',
        )
        .first();

      if (!estimate) {
        throw new NotFoundException('Estimate not found');
      }

      /*
       * Idempotency:
       * an already-linked estimate returns
       * the existing Job.
       */
      if (estimate.jobId) {
        const existingJob = await this.findJobRow(
          tx.orm,
          membership.organizationId,
          estimate.jobId,
        );

        if (existingJob) {
          return this.hydrateJob(tx.orm, existingJob);
        }

        throw new BadRequestException(
          'Estimate references a job that no longer exists',
        );
      }

      if (estimate.status !== EstimateStatus.APPROVED) {
        throw new BadRequestException(
          'Only approved estimates can be converted to jobs',
        );
      }

      const now = toPrisma8Timestamp();

      const jobName =
        clean(estimate.title ?? undefined) ?? `Job for ${estimate.number}`;

      const created = await tx.orm.public.Job.create({
        organizationId: membership.organizationId,

        customerId: estimate.customerId,

        createdByUserId: membership.userId,

        name: jobName,

        description: clean(estimate.notes ?? undefined) ?? null,

        status: JobStatus.APPROVED,

        priority: JobPriority.NORMAL,

        addressLine1: null,

        addressLine2: null,

        city: null,

        province: null,

        postalCode: null,

        country: 'CA',

        startDate: null,

        endDate: null,

        currency: estimate.currency,

        budgetCents: estimate.totalCents,

        archivedAt: null,

        createdAt: now,

        updatedAt: now,
      });

      /*
       * Preserve Prisma 7 updateMany().count:
       * exactly one transaction wins linking
       * an approved unlinked Estimate.
       */
      const linkPlan = db.raw.sql`
            UPDATE "Estimate"
            SET
              "jobId" = ${prisma8TextParam(created.id)},
              "updatedAt" = ${prisma8TimestampParam(now)}
            WHERE
              "id" = ${prisma8TextParam(estimate.id)}
              AND "organizationId" = ${prisma8TextParam(
                membership.organizationId,
              )}
              AND "jobId" IS NULL
              AND "status" = 'APPROVED'
          `
        .affectedCount()
        .build();

      const linked = await tx.execute(linkPlan);

      if (linked.affectedRows !== 1) {
        throw new BadRequestException(
          'Estimate was linked to another job while this request was processing',
        );
      }

      await this.createActivity(tx, {
        organizationId: membership.organizationId,

        customerId: estimate.customerId,

        actorUserId: membership.userId,

        type: 'JOB_CREATED',

        title: 'Job created',

        description: `${created.name} was created from estimate ${estimate.number}.`,

        metadata: {
          jobId: created.id,

          jobName: created.name,

          estimateId: estimate.id,

          estimateNumber: estimate.number,

          source: 'approved_estimate',

          status: created.status,

          budgetCents: created.budgetCents,
        },
      });

      return this.hydrateJob(tx.orm, created);
    });
  }

  async updateForUser(
    clerkUserId: string,
    jobId: string,
    input: UpdateJobDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const existing = await tx.orm.public.Job.where({
        id: jobId,

        organizationId: membership.organizationId,
      })
        .select(
          'id',
          'customerId',
          'name',
          'description',
          'status',
          'priority',
          'addressLine1',
          'addressLine2',
          'city',
          'province',
          'postalCode',
          'country',
          'startDate',
          'endDate',
          'currency',
          'budgetCents',
        )
        .first();

      if (!existing) {
        throw new NotFoundException('Job not found');
      }

      if (
        input.customerId !== undefined &&
        input.customerId !== existing.customerId
      ) {
        const customer = await tx.orm.public.Customer.where({
          id: input.customerId,

          organizationId: membership.organizationId,
        })
          .select('id')
          .first();

        if (!customer) {
          throw new NotFoundException('Customer not found');
        }
      }

      const existingStartDate =
        existing.startDate === null
          ? null
          : fromPrisma8Timestamp(existing.startDate);

      const existingEndDate =
        existing.endDate === null
          ? null
          : fromPrisma8Timestamp(existing.endDate);

      const nextValues = {
        customerId:
          input.customerId !== undefined
            ? input.customerId
            : existing.customerId,

        name: input.name !== undefined ? input.name.trim() : existing.name,

        description:
          input.description !== undefined
            ? (clean(input.description) ?? null)
            : existing.description,

        status: input.status !== undefined ? input.status : existing.status,

        priority:
          input.priority !== undefined ? input.priority : existing.priority,

        addressLine1:
          input.addressLine1 !== undefined
            ? (clean(input.addressLine1) ?? null)
            : existing.addressLine1,

        addressLine2:
          input.addressLine2 !== undefined
            ? (clean(input.addressLine2) ?? null)
            : existing.addressLine2,

        city:
          input.city !== undefined
            ? (clean(input.city) ?? null)
            : existing.city,

        province:
          input.province !== undefined
            ? (clean(input.province) ?? null)
            : existing.province,

        postalCode:
          input.postalCode !== undefined
            ? (clean(input.postalCode) ?? null)
            : existing.postalCode,

        country:
          input.country !== undefined
            ? (clean(input.country) ?? 'CA')
            : existing.country,

        startDate:
          input.startDate !== undefined
            ? new Date(input.startDate)
            : existingStartDate,

        endDate:
          input.endDate !== undefined
            ? new Date(input.endDate)
            : existingEndDate,

        budgetCents:
          input.budgetCents !== undefined
            ? input.budgetCents
            : existing.budgetCents,
      };

      /*
       * Backend invariant:
       * only run completion checks when
       * transitioning INTO COMPLETED.
       */
      if (
        nextValues.status === JobStatus.COMPLETED &&
        existing.status !== JobStatus.COMPLETED
      ) {
        await this.requireJobReadyForCompletion(
          membership.organizationId,
          jobId,
          tx,
        );
      }

      const changes: JobChangeMap = {};

      addChange(changes, 'name', existing.name, nextValues.name);

      addChange(
        changes,
        'description',
        existing.description,
        nextValues.description,
      );

      addChange(changes, 'status', existing.status, nextValues.status);

      addChange(changes, 'priority', existing.priority, nextValues.priority);

      addChange(
        changes,
        'addressLine1',
        existing.addressLine1,
        nextValues.addressLine1,
      );

      addChange(
        changes,
        'addressLine2',
        existing.addressLine2,
        nextValues.addressLine2,
      );

      addChange(changes, 'city', existing.city, nextValues.city);

      addChange(changes, 'province', existing.province, nextValues.province);

      addChange(
        changes,
        'postalCode',
        existing.postalCode,
        nextValues.postalCode,
      );

      addChange(changes, 'country', existing.country, nextValues.country);

      addChange(
        changes,
        'budgetCents',
        existing.budgetCents,
        nextValues.budgetCents,
      );

      addDateChange(
        changes,
        'startDate',
        existingStartDate,
        nextValues.startDate,
      );

      addDateChange(changes, 'endDate', existingEndDate, nextValues.endDate);

      const customerChanged = existing.customerId !== nextValues.customerId;

      if (customerChanged) {
        changes.customerId = {
          oldValue: existing.customerId,

          newValue: nextValues.customerId,
        };
      }

      const now = toPrisma8Timestamp();

      const updated = await tx.orm.public.Job.where({
        id: jobId,

        organizationId: membership.organizationId,
      }).update({
        customerId: nextValues.customerId,

        name: nextValues.name,

        description: nextValues.description,

        status: nextValues.status,

        priority: nextValues.priority,

        addressLine1: nextValues.addressLine1,

        addressLine2: nextValues.addressLine2,

        city: nextValues.city,

        province: nextValues.province,

        postalCode: nextValues.postalCode,

        country: nextValues.country,

        startDate:
          nextValues.startDate === null
            ? null
            : toPrisma8Timestamp(nextValues.startDate),

        endDate:
          nextValues.endDate === null
            ? null
            : toPrisma8Timestamp(nextValues.endDate),

        budgetCents: nextValues.budgetCents,

        updatedAt: now,
      });

      if (!updated) {
        throw new NotFoundException('Job not found');
      }

      if (Object.keys(changes).length > 0) {
        const metadata = {
          jobId: updated.id,

          jobName: updated.name,

          changes,
        };

        await this.createActivity(tx, {
          organizationId: membership.organizationId,

          customerId: existing.customerId,

          actorUserId: membership.userId,

          type: 'JOB_UPDATED',

          title: 'Job updated',

          description: `${updated.name} was updated.`,

          metadata,
        });

        if (customerChanged) {
          await this.createActivity(tx, {
            organizationId: membership.organizationId,

            customerId: nextValues.customerId,

            actorUserId: membership.userId,

            type: 'JOB_UPDATED',

            title: 'Job assigned',

            description: `${updated.name} was assigned to this customer.`,

            metadata,
          });
        }
      }

      return this.hydrateJob(tx.orm, updated);
    });
  }

  async archiveForUser(
    clerkUserId: string,
    jobId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const existing = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx.orm,
      );

      const now = toPrisma8Timestamp();

      const updated = await tx.orm.public.Job.where({
        id: jobId,

        organizationId: membership.organizationId,
      }).update({
        archivedAt: now,

        updatedAt: now,
      });

      if (!updated) {
        throw new NotFoundException('Job not found');
      }

      await this.createActivity(tx, {
        organizationId: membership.organizationId,

        customerId: existing.customerId,

        actorUserId: membership.userId,

        type: 'JOB_ARCHIVED',

        title: 'Job archived',

        description: `${updated.name} was archived.`,

        metadata: {
          jobId: updated.id,

          jobName: updated.name,
        },
      });

      return this.hydrateJob(tx.orm, updated);
    });
  }

  async restoreForUser(
    clerkUserId: string,
    jobId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const existing = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx.orm,
      );

      const now = toPrisma8Timestamp();

      const updated = await tx.orm.public.Job.where({
        id: jobId,

        organizationId: membership.organizationId,
      }).update({
        archivedAt: null,

        updatedAt: now,
      });

      if (!updated) {
        throw new NotFoundException('Job not found');
      }

      await this.createActivity(tx, {
        organizationId: membership.organizationId,

        customerId: existing.customerId,

        actorUserId: membership.userId,

        type: 'JOB_RESTORED',

        title: 'Job restored',

        description: `${updated.name} was restored.`,

        metadata: {
          jobId: updated.id,

          jobName: updated.name,
        },
      });

      return this.hydrateJob(tx.orm, updated);
    });
  }

  private async requireJobReadyForCompletion(
    organizationId: string,
    jobId: string,
    tx: DatabaseTransaction,
  ) {
    const tasks = await tx.orm.public.JobTask.where({
      organizationId,
      jobId,
    })
      .select('id', 'status')
      .all();

    const activeTaskCount = tasks.filter(
      (task) => !INACTIVE_TASK_STATUSES.has(task.status),
    ).length;

    const schedules = await tx.orm.public.JobSchedule.where({
      organizationId,
      jobId,
    })
      .select('id', 'status')
      .all();

    const activeScheduleCount = schedules.filter((schedule) =>
      ACTIVE_SCHEDULE_STATUSES.has(schedule.status),
    ).length;

    const checklists = await tx.orm.public.JobChecklist.where({
      organizationId,
      jobId,
    })
      .select('id')
      .all();

    let incompleteChecklistItemCount = 0;

    for (const checklist of checklists) {
      const items = await tx.orm.public.JobChecklistItem.where({
        organizationId,

        checklistId: checklist.id,
      })
        .select('id', 'completedAt')
        .all();

      incompleteChecklistItemCount += items.filter(
        (item) => item.completedAt === null,
      ).length;
    }

    if (
      activeTaskCount === 0 &&
      activeScheduleCount === 0 &&
      incompleteChecklistItemCount === 0
    ) {
      return;
    }

    const blockers: string[] = [];

    if (activeTaskCount > 0) {
      blockers.push(
        `${activeTaskCount} active task${
          activeTaskCount === 1 ? '' : 's'
        } remain`,
      );
    }

    if (activeScheduleCount > 0) {
      blockers.push(
        `${activeScheduleCount} outstanding scheduled event${
          activeScheduleCount === 1 ? '' : 's'
        } remain`,
      );
    }

    if (incompleteChecklistItemCount > 0) {
      blockers.push(
        `${incompleteChecklistItemCount} checklist item${
          incompleteChecklistItemCount === 1 ? '' : 's'
        } remain`,
      );
    }

    throw new BadRequestException({
      message: 'Job is not ready to complete',

      code: 'JOB_NOT_READY_FOR_COMPLETION',

      blockers,

      activeTaskCount,

      activeScheduleCount,

      incompleteChecklistItemCount,
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
      .select('id', 'customerId')
      .first();

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  private async findJobRow(
    orm: OrmSource,
    organizationId: string,
    jobId: string,
  ) {
    return orm.public.Job.where({
      id: jobId,

      organizationId,
    })
      .select(...JOB_FIELDS)
      .first();
  }

  private async hydrateJob(orm: OrmSource, job: JobRow) {
    const customer = await orm.public.Customer.where({
      id: job.customerId,
    })
      .select('id', 'firstName', 'lastName', 'companyName')
      .first();

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const createdBy =
      job.createdByUserId === null
        ? null
        : await orm.public.User.where({
            id: job.createdByUserId,
          })
            .select('id', 'firstName', 'lastName', 'email')
            .first();

    return {
      id: job.id,

      organizationId: job.organizationId,

      customerId: job.customerId,

      createdByUserId: job.createdByUserId,

      name: job.name,

      description: job.description,

      status: job.status,

      priority: job.priority,

      addressLine1: job.addressLine1,

      addressLine2: job.addressLine2,

      city: job.city,

      province: job.province,

      postalCode: job.postalCode,

      country: job.country,

      startDate:
        job.startDate === null ? null : fromPrisma8Timestamp(job.startDate),

      endDate: job.endDate === null ? null : fromPrisma8Timestamp(job.endDate),

      currency: job.currency,

      budgetCents: job.budgetCents,

      archivedAt:
        job.archivedAt === null ? null : fromPrisma8Timestamp(job.archivedAt),

      createdAt: fromPrisma8Timestamp(job.createdAt),

      updatedAt: fromPrisma8Timestamp(job.updatedAt),

      customer,

      createdBy,
    };
  }

  private async createActivity(
    tx: DatabaseTransaction,
    input: {
      organizationId: string;
      customerId: string;
      actorUserId: string | null;

      type: 'JOB_CREATED' | 'JOB_UPDATED' | 'JOB_ARCHIVED' | 'JOB_RESTORED';

      title: string;

      description: string;

      metadata: CustomerActivityMetadata;
    },
  ) {
    await tx.orm.public.CustomerActivity.create({
      organizationId: input.organizationId,

      customerId: input.customerId,

      actorUserId: input.actorUserId,

      _type: input.type,

      title: input.title,

      description: input.description,

      metadata: input.metadata,

      createdAt: toPrisma8Timestamp(),
    });
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }
}

const JOB_FIELDS = [
  'id',
  'organizationId',
  'customerId',
  'createdByUserId',

  'name',
  'description',
  'status',
  'priority',

  'addressLine1',
  'addressLine2',
  'city',
  'province',
  'postalCode',
  'country',

  'startDate',
  'endDate',
  'currency',
  'budgetCents',
  'archivedAt',

  'createdAt',
  'updatedAt',
] as const;

function compareDispatchJobs(left: JobRow, right: JobRow) {
  const priorityDifference =
    (PRIORITY_RANK[right.priority] ?? 0) - (PRIORITY_RANK[left.priority] ?? 0);

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  if (left.startDate === null && right.startDate !== null) {
    return 1;
  }

  if (left.startDate !== null && right.startDate === null) {
    return -1;
  }

  if (left.startDate !== null && right.startDate !== null) {
    const dateDifference =
      fromPrisma8Timestamp(left.startDate).getTime() -
      fromPrisma8Timestamp(right.startDate).getTime();

    if (dateDifference !== 0) {
      return dateDifference;
    }
  }

  return (
    fromPrisma8Timestamp(left.createdAt).getTime() -
    fromPrisma8Timestamp(right.createdAt).getTime()
  );
}

function metadataHasJobId(metadata: unknown, jobId: string) {
  if (
    metadata === null ||
    typeof metadata !== 'object' ||
    Array.isArray(metadata)
  ) {
    return false;
  }

  return (metadata as Record<string, unknown>).jobId === jobId;
}

function addChange(
  changes: JobChangeMap,
  field: string,
  oldValue: string | number | null,
  newValue: string | number | null,
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
  changes: JobChangeMap,
  field: string,
  oldValue: Date | null,
  newValue: Date | null,
) {
  const oldDate = oldValue?.toISOString() ?? null;

  const newDate = newValue?.toISOString() ?? null;

  addChange(changes, field, oldDate, newDate);
}

function clean(value: string | undefined): string | undefined {
  const result = value?.trim();

  return result || undefined;
}
