import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerActivityType,
  EstimateStatus,
  JobPriority,
  JobScheduleStatus,
  JobStatus,
  JobTaskStatus,
  Prisma,
  prisma,
} from '@contractflow/db';

import { ActivityService } from '../activity/activity.service';
import type { CreateJobDto } from './dto/create-job.dto';
import type { UpdateJobDto } from './dto/update-job.dto';

@Injectable()
export class JobsService {
  constructor(private readonly activityService: ActivityService) {}

  async listForUser(clerkUserId: string, includeArchived = false) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.job.findMany({
      where: {
        organizationId: membership.organizationId,
        ...(includeArchived
          ? {}
          : {
              archivedAt: null,
            }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: this.jobSelect(),
    });
  }

  async listForCustomerForUser(
    clerkUserId: string,
    customerId: string,
    includeArchived = false,
  ) {
    const membership = await this.getMembership(clerkUserId);

    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId: membership.organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return prisma.job.findMany({
      where: {
        organizationId: membership.organizationId,
        customerId,
        ...(includeArchived
          ? {}
          : {
              archivedAt: null,
            }),
      },
      orderBy: [
        {
          archivedAt: 'asc',
        },
        {
          createdAt: 'desc',
        },
      ],
      select: this.jobSelect(),
    });
  }

  async getByIdForUser(clerkUserId: string, jobId: string) {
    const membership = await this.getMembership(clerkUserId);

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        organizationId: membership.organizationId,
      },
      select: this.jobSelect(),
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  async listActivityForUser(clerkUserId: string, jobId: string) {
    const membership = await this.getMembership(clerkUserId);

    const job = await this.requireJobForOrganization(
      membership.organizationId,
      jobId,
    );

    return this.activityService.listJobActivity(
      membership.organizationId,
      job.customerId,
      job.id,
    );
  }

  async createForUser(clerkUserId: string, input: CreateJobDto) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: {
          id: input.customerId,
          organizationId: membership.organizationId,
        },
        select: {
          id: true,
        },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      const job = await tx.job.create({
        data: {
          organizationId: membership.organizationId,
          customerId: input.customerId,
          createdByUserId: membership.userId,

          name: input.name.trim(),
          description: clean(input.description),

          status: input.status,
          priority: input.priority,

          addressLine1: clean(input.addressLine1),
          addressLine2: clean(input.addressLine2),
          city: clean(input.city),
          province: clean(input.province),
          postalCode: clean(input.postalCode),
          country: clean(input.country) ?? 'CA',

          startDate: input.startDate ? new Date(input.startDate) : undefined,

          endDate: input.endDate ? new Date(input.endDate) : undefined,

          budgetCents: input.budgetCents,
        },
        select: this.jobSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customer.id,
          actorUserId: membership.userId,

          type: CustomerActivityType.JOB_CREATED,

          title: 'Job created',

          description: `${job.name} was created.`,

          metadata: {
            jobId: job.id,
            jobName: job.name,
          },
        },
        tx,
      );

      return job;
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
          totalCents: true,
        },
      });

      if (!estimate) {
        throw new NotFoundException('Estimate not found');
      }

      /*
       * Idempotency:
       *
       * If this estimate has already been converted to a job,
       * return that job instead of creating another one.
       */
      if (estimate.jobId) {
        const existingJob = await tx.job.findFirst({
          where: {
            id: estimate.jobId,
            organizationId: membership.organizationId,
          },
          select: this.jobSelect(),
        });

        if (existingJob) {
          return existingJob;
        }

        /*
         * The relation uses onDelete: SetNull, so this should normally
         * never occur. Treat a dangling job reference as invalid data
         * rather than silently creating a duplicate job.
         */
        throw new BadRequestException(
          'Estimate references a job that no longer exists',
        );
      }

      if (estimate.status !== EstimateStatus.APPROVED) {
        throw new BadRequestException(
          'Only approved estimates can be converted to jobs',
        );
      }

      const jobName =
        clean(estimate.title ?? undefined) ?? `Job for ${estimate.number}`;

      const job = await tx.job.create({
        data: {
          organizationId: membership.organizationId,
          customerId: estimate.customerId,
          createdByUserId: membership.userId,

          name: jobName,
          description: clean(estimate.notes ?? undefined),

          status: JobStatus.APPROVED,
          priority: JobPriority.NORMAL,

          budgetCents: estimate.totalCents,
        },
        select: this.jobSelect(),
      });

      /*
       * Conditional update protects against two simultaneous requests
       * attempting to create a job from the same estimate.
       */
      const linked = await tx.estimate.updateMany({
        where: {
          id: estimate.id,
          organizationId: membership.organizationId,
          jobId: null,
          status: EstimateStatus.APPROVED,
        },
        data: {
          jobId: job.id,
        },
      });

      if (linked.count !== 1) {
        /*
         * Throwing rolls the transaction back, including the job we
         * just created. The caller can retry and receive the job that
         * won the concurrent race.
         */
        throw new BadRequestException(
          'Estimate was linked to another job while this request was processing',
        );
      }

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: estimate.customerId,
          actorUserId: membership.userId,

          type: CustomerActivityType.JOB_CREATED,

          title: 'Job created',

          description: `${job.name} was created from estimate ${estimate.number}.`,

          metadata: {
            jobId: job.id,
            jobName: job.name,

            estimateId: estimate.id,
            estimateNumber: estimate.number,

            source: 'approved_estimate',

            status: job.status,
            budgetCents: job.budgetCents,
          },
        },
        tx,
      );

      return job;
    });
  }

  async updateForUser(clerkUserId: string, jobId: string, input: UpdateJobDto) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const existing = await tx.job.findFirst({
        where: {
          id: jobId,
          organizationId: membership.organizationId,
        },
        select: {
          id: true,
          customerId: true,
          name: true,
          description: true,
          status: true,
          priority: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          province: true,
          postalCode: true,
          country: true,
          startDate: true,
          endDate: true,
          budgetCents: true,
        },
      });

      if (!existing) {
        throw new NotFoundException('Job not found');
      }

      if (
        input.customerId !== undefined &&
        input.customerId !== existing.customerId
      ) {
        const customer = await tx.customer.findFirst({
          where: {
            id: input.customerId,
            organizationId: membership.organizationId,
          },
          select: {
            id: true,
          },
        });

        if (!customer) {
          throw new NotFoundException('Customer not found');
        }
      }

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
            : existing.startDate,

        endDate:
          input.endDate !== undefined
            ? new Date(input.endDate)
            : existing.endDate,

        budgetCents:
          input.budgetCents !== undefined
            ? input.budgetCents
            : existing.budgetCents,
      };

      /*
       * Job completion is a backend invariant.
       *
       * The web UI also prevents premature completion, but the API must
       * independently enforce the rule so direct API requests and future
       * clients cannot bypass it.
       *
       * Only enforce the check when transitioning INTO COMPLETED.
       * Updating an unrelated field on an already-completed job should
       * not cause the completion guard to run again.
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

      const changes: Record<
        string,
        {
          oldValue: string | number | null;
          newValue: string | number | null;
        }
      > = {};

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
        existing.startDate,
        nextValues.startDate,
      );

      addDateChange(changes, 'endDate', existing.endDate, nextValues.endDate);

      const customerChanged = existing.customerId !== nextValues.customerId;

      if (customerChanged) {
        changes.customerId = {
          oldValue: existing.customerId,
          newValue: nextValues.customerId,
        };
      }

      const job = await tx.job.update({
        where: {
          id: jobId,
        },
        data: {
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
          startDate: nextValues.startDate,
          endDate: nextValues.endDate,
          budgetCents: nextValues.budgetCents,
        },
        select: this.jobSelect(),
      });

      if (Object.keys(changes).length > 0) {
        const metadata = {
          jobId: job.id,
          jobName: job.name,
          changes,
        };

        await this.activityService.recordCustomerActivity(
          {
            organizationId: membership.organizationId,
            customerId: existing.customerId,
            actorUserId: membership.userId,

            type: CustomerActivityType.JOB_UPDATED,

            title: 'Job updated',

            description: `${job.name} was updated.`,

            metadata,
          },
          tx,
        );

        if (customerChanged) {
          await this.activityService.recordCustomerActivity(
            {
              organizationId: membership.organizationId,
              customerId: nextValues.customerId,
              actorUserId: membership.userId,

              type: CustomerActivityType.JOB_UPDATED,

              title: 'Job assigned',

              description: `${job.name} was assigned to this customer.`,

              metadata,
            },
            tx,
          );
        }
      }

      return job;
    });
  }

  async archiveForUser(clerkUserId: string, jobId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const existing = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const job = await tx.job.update({
        where: {
          id: jobId,
        },
        data: {
          archivedAt: new Date(),
        },
        select: this.jobSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: existing.customerId,
          actorUserId: membership.userId,

          type: CustomerActivityType.JOB_ARCHIVED,

          title: 'Job archived',

          description: `${job.name} was archived.`,

          metadata: {
            jobId: job.id,
            jobName: job.name,
          },
        },
        tx,
      );

      return job;
    });
  }

  async restoreForUser(clerkUserId: string, jobId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const existing = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const job = await tx.job.update({
        where: {
          id: jobId,
        },
        data: {
          archivedAt: null,
        },
        select: this.jobSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: existing.customerId,
          actorUserId: membership.userId,

          type: CustomerActivityType.JOB_RESTORED,

          title: 'Job restored',

          description: `${job.name} was restored.`,

          metadata: {
            jobId: job.id,
            jobName: job.name,
          },
        },
        tx,
      );

      return job;
    });
  }

  private async requireJobReadyForCompletion(
    organizationId: string,
    jobId: string,
    client: Prisma.TransactionClient,
  ) {
    const [activeTaskCount, activeScheduleCount] = await Promise.all([
      client.jobTask.count({
        where: {
          organizationId,
          jobId,

          status: {
            notIn: [JobTaskStatus.COMPLETED, JobTaskStatus.CANCELLED],
          },
        },
      }),

      client.jobSchedule.count({
        where: {
          organizationId,
          jobId,

          status: {
            in: [JobScheduleStatus.SCHEDULED, JobScheduleStatus.IN_PROGRESS],
          },
        },
      }),
    ]);

    if (activeTaskCount === 0 && activeScheduleCount === 0) {
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

    throw new BadRequestException({
      message: 'Job is not ready to complete',

      code: 'JOB_NOT_READY_FOR_COMPLETION',

      blockers,

      activeTaskCount,

      activeScheduleCount,
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
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
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

  private jobSelect(): Prisma.JobSelect {
    return {
      id: true,
      organizationId: true,
      customerId: true,
      createdByUserId: true,

      name: true,
      description: true,
      status: true,
      priority: true,

      addressLine1: true,
      addressLine2: true,
      city: true,
      province: true,
      postalCode: true,
      country: true,

      startDate: true,
      endDate: true,
      budgetCents: true,
      archivedAt: true,

      createdAt: true,
      updatedAt: true,

      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          companyName: true,
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
    };
  }
}

type JobChangeMap = Record<
  string,
  {
    oldValue: string | number | null;
    newValue: string | number | null;
  }
>;

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
