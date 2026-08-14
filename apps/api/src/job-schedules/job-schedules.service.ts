import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerActivityType,
  JobScheduleStatus,
  JobScheduleType,
  Prisma,
  prisma,
} from '@contractflow/db';

import { ActivityService } from '../activity/activity.service';
import type { CreateJobScheduleDto } from './dto/create-job-schedule.dto';
import type { UpdateJobScheduleDto } from './dto/update-job-schedule.dto';

@Injectable()
export class JobSchedulesService {
  constructor(private readonly activityService: ActivityService) {}

  async listForJobForUser(
    clerkUserId: string,
    jobId: string,
    includeCancelled = false,
  ) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireJobForOrganization(membership.organizationId, jobId);

    return prisma.jobSchedule.findMany({
      where: {
        organizationId: membership.organizationId,
        jobId,
        ...(includeCancelled
          ? {}
          : {
              status: {
                not: JobScheduleStatus.CANCELLED,
              },
            }),
      },
      orderBy: {
        startAt: 'asc',
      },
      select: this.scheduleSelect(),
    });
  }

  async listForOrganizationForUser(
    clerkUserId: string,
    options?: {
      from?: string;
      to?: string;
      includeCancelled?: boolean;
    },
  ) {
    const membership = await this.getMembership(clerkUserId);

    const from = options?.from ? new Date(options.from) : undefined;

    const to = options?.to ? new Date(options.to) : undefined;

    if (from && to && to.getTime() < from.getTime()) {
      throw new BadRequestException(
        'Schedule end range cannot be before start range',
      );
    }

    return prisma.jobSchedule.findMany({
      where: {
        organizationId: membership.organizationId,

        ...(options?.includeCancelled
          ? {}
          : {
              status: {
                not: JobScheduleStatus.CANCELLED,
              },
            }),

        ...(from || to
          ? {
              startAt: {
                ...(from
                  ? {
                      gte: from,
                    }
                  : {}),

                ...(to
                  ? {
                      lte: to,
                    }
                  : {}),
              },
            }
          : {}),
      },

      orderBy: {
        startAt: 'asc',
      },

      select: this.scheduleSelect(),
    });
  }

  async createForUser(
    clerkUserId: string,
    jobId: string,
    input: CreateJobScheduleDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const startAt = new Date(input.startAt);

      const endAt = input.endAt ? new Date(input.endAt) : null;

      this.validateDateRange(startAt, endAt);

      const status = input.status ?? JobScheduleStatus.SCHEDULED;

      const schedule = await tx.jobSchedule.create({
        data: {
          organizationId: membership.organizationId,

          jobId,

          createdByUserId: membership.userId,

          type: input.type ?? JobScheduleType.WORK,

          status,

          title: input.title.trim(),

          description: clean(input.description),

          startAt,
          endAt,

          allDay: input.allDay ?? false,

          location: clean(input.location),

          notes: clean(input.notes),

          cancelledAt:
            status === JobScheduleStatus.CANCELLED ? new Date() : null,
        },

        select: this.scheduleSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,

          customerId: job.customerId,

          actorUserId: membership.userId,

          type: CustomerActivityType.SCHEDULE_CREATED,

          title: 'Schedule created',

          description: `${schedule.title} was scheduled for ${job.name}.`,

          metadata: {
            jobId: job.id,
            jobName: job.name,

            scheduleId: schedule.id,

            scheduleTitle: schedule.title,

            scheduleType: schedule.type,

            startAt: schedule.startAt.toISOString(),

            endAt: schedule.endAt?.toISOString() ?? null,
          },
        },
        tx,
      );

      return schedule;
    });
  }

  async updateForUser(
    clerkUserId: string,
    jobId: string,
    scheduleId: string,
    input: UpdateJobScheduleDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const existing = await this.requireScheduleForJob(
        membership.organizationId,
        jobId,
        scheduleId,
        tx,
      );

      const nextValues = {
        title: input.title !== undefined ? input.title.trim() : existing.title,

        description:
          input.description !== undefined
            ? (clean(input.description) ?? null)
            : existing.description,

        type: input.type !== undefined ? input.type : existing.type,

        status: input.status !== undefined ? input.status : existing.status,

        startAt:
          input.startAt !== undefined
            ? new Date(input.startAt)
            : existing.startAt,

        endAt:
          input.endAt !== undefined
            ? input.endAt
              ? new Date(input.endAt)
              : null
            : existing.endAt,

        allDay: input.allDay !== undefined ? input.allDay : existing.allDay,

        location:
          input.location !== undefined
            ? (clean(input.location) ?? null)
            : existing.location,

        notes:
          input.notes !== undefined
            ? (clean(input.notes) ?? null)
            : existing.notes,
      };

      this.validateDateRange(nextValues.startAt, nextValues.endAt);

      const changes: ScheduleChangeMap = {};

      addChange(changes, 'title', existing.title, nextValues.title);

      addChange(
        changes,
        'description',
        existing.description,
        nextValues.description,
      );

      addChange(changes, 'type', existing.type, nextValues.type);

      addChange(changes, 'status', existing.status, nextValues.status);

      addDateChange(changes, 'startAt', existing.startAt, nextValues.startAt);

      addDateChange(changes, 'endAt', existing.endAt, nextValues.endAt);

      addBooleanChange(changes, 'allDay', existing.allDay, nextValues.allDay);

      addChange(changes, 'location', existing.location, nextValues.location);

      addChange(changes, 'notes', existing.notes, nextValues.notes);

      let cancelledAt = existing.cancelledAt;

      if (
        nextValues.status === JobScheduleStatus.CANCELLED &&
        existing.status !== JobScheduleStatus.CANCELLED
      ) {
        cancelledAt = new Date();
      }

      if (
        nextValues.status !== JobScheduleStatus.CANCELLED &&
        existing.status === JobScheduleStatus.CANCELLED
      ) {
        cancelledAt = null;
      }

      const schedule = await tx.jobSchedule.update({
        where: {
          id: scheduleId,
        },

        data: {
          title: nextValues.title,
          description: nextValues.description,
          type: nextValues.type,
          status: nextValues.status,
          startAt: nextValues.startAt,
          endAt: nextValues.endAt,
          allDay: nextValues.allDay,
          location: nextValues.location,
          notes: nextValues.notes,
          cancelledAt,
        },

        select: this.scheduleSelect(),
      });

      if (Object.keys(changes).length > 0) {
        await this.activityService.recordCustomerActivity(
          {
            organizationId: membership.organizationId,

            customerId: job.customerId,

            actorUserId: membership.userId,

            type: CustomerActivityType.SCHEDULE_UPDATED,

            title: 'Schedule updated',

            description: `${schedule.title} was updated for ${job.name}.`,

            metadata: {
              jobId: job.id,
              jobName: job.name,

              scheduleId: schedule.id,

              scheduleTitle: schedule.title,

              changes,
            },
          },
          tx,
        );
      }

      return schedule;
    });
  }

  async cancelForUser(clerkUserId: string, jobId: string, scheduleId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const existing = await this.requireScheduleForJob(
        membership.organizationId,
        jobId,
        scheduleId,
        tx,
      );

      if (existing.status === JobScheduleStatus.CANCELLED) {
        return tx.jobSchedule.findUniqueOrThrow({
          where: {
            id: scheduleId,
          },
          select: this.scheduleSelect(),
        });
      }

      const schedule = await tx.jobSchedule.update({
        where: {
          id: scheduleId,
        },

        data: {
          status: JobScheduleStatus.CANCELLED,

          cancelledAt: new Date(),
        },

        select: this.scheduleSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,

          customerId: job.customerId,

          actorUserId: membership.userId,

          type: CustomerActivityType.SCHEDULE_CANCELLED,

          title: 'Schedule cancelled',

          description: `${schedule.title} was cancelled for ${job.name}.`,

          metadata: {
            jobId: job.id,
            jobName: job.name,

            scheduleId: schedule.id,

            scheduleTitle: schedule.title,

            startAt: schedule.startAt.toISOString(),
          },
        },
        tx,
      );

      return schedule;
    });
  }

  async restoreForUser(clerkUserId: string, jobId: string, scheduleId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const existing = await this.requireScheduleForJob(
        membership.organizationId,
        jobId,
        scheduleId,
        tx,
      );

      if (existing.status !== JobScheduleStatus.CANCELLED) {
        return tx.jobSchedule.findUniqueOrThrow({
          where: {
            id: scheduleId,
          },
          select: this.scheduleSelect(),
        });
      }

      const schedule = await tx.jobSchedule.update({
        where: {
          id: scheduleId,
        },

        data: {
          status: JobScheduleStatus.SCHEDULED,

          cancelledAt: null,
        },

        select: this.scheduleSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,

          customerId: job.customerId,

          actorUserId: membership.userId,

          type: CustomerActivityType.SCHEDULE_RESTORED,

          title: 'Schedule restored',

          description: `${schedule.title} was restored for ${job.name}.`,

          metadata: {
            jobId: job.id,
            jobName: job.name,

            scheduleId: schedule.id,

            scheduleTitle: schedule.title,

            startAt: schedule.startAt.toISOString(),
          },
        },
        tx,
      );

      return schedule;
    });
  }

  private validateDateRange(startAt: Date, endAt: Date | null) {
    if (endAt && endAt.getTime() < startAt.getTime()) {
      throw new BadRequestException(
        'Schedule end time cannot be before start time',
      );
    }
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

  private async requireScheduleForJob(
    organizationId: string,
    jobId: string,
    scheduleId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const schedule = await client.jobSchedule.findFirst({
      where: {
        id: scheduleId,
        jobId,
        organizationId,
      },

      select: {
        id: true,

        title: true,
        description: true,

        type: true,
        status: true,

        startAt: true,
        endAt: true,
        allDay: true,

        location: true,
        notes: true,

        cancelledAt: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule event not found');
    }

    return schedule;
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

  private scheduleSelect(): Prisma.JobScheduleSelect {
    return {
      id: true,
      organizationId: true,
      jobId: true,
      createdByUserId: true,

      type: true,
      status: true,

      title: true,
      description: true,

      startAt: true,
      endAt: true,
      allDay: true,

      location: true,
      notes: true,

      cancelledAt: true,

      createdAt: true,
      updatedAt: true,

      job: {
        select: {
          id: true,
          name: true,

          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },
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

type ScheduleChangeMap = Record<
  string,
  {
    oldValue: string | boolean | null;

    newValue: string | boolean | null;
  }
>;

function addChange(
  changes: ScheduleChangeMap,
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
  changes: ScheduleChangeMap,
  field: string,
  oldValue: Date | null,
  newValue: Date | null,
) {
  addChange(
    changes,
    field,
    oldValue?.toISOString() ?? null,
    newValue?.toISOString() ?? null,
  );
}

function addBooleanChange(
  changes: ScheduleChangeMap,
  field: string,
  oldValue: boolean,
  newValue: boolean,
) {
  if (oldValue === newValue) {
    return;
  }

  changes[field] = {
    oldValue,
    newValue,
  };
}

function clean(value: string | undefined): string | undefined {
  const result = value?.trim();

  return result || undefined;
}
