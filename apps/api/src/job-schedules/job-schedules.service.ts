import {
  BadRequestException,
  ConflictException,
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
import type { DispatchJobScheduleDto } from './dto/dispatch-job-schedule.dto';
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
      crewMemberId?: string;
    },
  ) {
    const membership = await this.getMembership(clerkUserId);

    const from = options?.from ? new Date(options.from) : undefined;
    const to = options?.to ? new Date(options.to) : undefined;

    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException('Schedule start range is invalid');
    }

    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException('Schedule end range is invalid');
    }

    if (from && to && to.getTime() < from.getTime()) {
      throw new BadRequestException(
        'Schedule end range cannot be before start range',
      );
    }

    if (options?.crewMemberId) {
      await this.requireCrewMemberForOrganization(
        membership.organizationId,
        options.crewMemberId,
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

        ...(options?.crewMemberId
          ? {
              crewMembers: {
                some: {
                  crewMemberId: options.crewMemberId,
                },
              },
            }
          : {}),

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

      if (nextValues.status !== JobScheduleStatus.CANCELLED) {
        await this.validateAssignedCrewAvailability(
          membership.organizationId,
          scheduleId,
          nextValues.startAt,
          nextValues.endAt,
          tx,
        );
      }

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

  async assignCrewMemberForUser(
    clerkUserId: string,
    jobId: string,
    scheduleId: string,
    crewMemberId: string,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const schedule = await this.requireScheduleForJob(
        membership.organizationId,
        jobId,
        scheduleId,
        tx,
      );

      if (schedule.status === JobScheduleStatus.CANCELLED) {
        throw new BadRequestException(
          'Crew cannot be assigned to a cancelled schedule',
        );
      }

      const crewMember = await this.requireCrewMemberForOrganization(
        membership.organizationId,
        crewMemberId,
        tx,
      );

      if (!crewMember.active) {
        throw new BadRequestException(
          'Inactive crew members cannot be assigned to schedules',
        );
      }

      const existingAssignment = await tx.jobScheduleCrewMember.findUnique({
        where: {
          jobScheduleId_crewMemberId: {
            jobScheduleId: schedule.id,
            crewMemberId: crewMember.id,
          },
        },

        select: {
          id: true,
        },
      });

      if (existingAssignment) {
        return tx.jobSchedule.findUniqueOrThrow({
          where: {
            id: schedule.id,
          },

          select: this.scheduleSelect(),
        });
      }

      await this.assertCrewMemberAvailable(
        membership.organizationId,
        crewMember.id,
        schedule.id,
        schedule.startAt,
        schedule.endAt,
        tx,
      );

      await tx.jobScheduleCrewMember.create({
        data: {
          organizationId: membership.organizationId,
          jobScheduleId: schedule.id,
          crewMemberId: crewMember.id,
        },
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,

          customerId: job.customerId,

          actorUserId: membership.userId,

          type: CustomerActivityType.SCHEDULE_UPDATED,

          title: 'Crew assigned',

          description: `${crewMemberDisplayName(
            crewMember,
          )} was assigned to ${schedule.title}.`,

          metadata: {
            jobId: job.id,
            jobName: job.name,

            scheduleId: schedule.id,
            scheduleTitle: schedule.title,

            crewMemberId: crewMember.id,
            crewMemberName: crewMemberDisplayName(crewMember),

            action: 'crew_assigned',
          },
        },
        tx,
      );

      return tx.jobSchedule.findUniqueOrThrow({
        where: {
          id: schedule.id,
        },

        select: this.scheduleSelect(),
      });
    });
  }

  async removeCrewMemberForUser(
    clerkUserId: string,
    jobId: string,
    scheduleId: string,
    crewMemberId: string,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const schedule = await this.requireScheduleForJob(
        membership.organizationId,
        jobId,
        scheduleId,
        tx,
      );

      const crewMember = await this.requireCrewMemberForOrganization(
        membership.organizationId,
        crewMemberId,
        tx,
      );

      const assignment = await tx.jobScheduleCrewMember.findUnique({
        where: {
          jobScheduleId_crewMemberId: {
            jobScheduleId: schedule.id,
            crewMemberId: crewMember.id,
          },
        },

        select: {
          id: true,
        },
      });

      if (!assignment) {
        return tx.jobSchedule.findUniqueOrThrow({
          where: {
            id: schedule.id,
          },

          select: this.scheduleSelect(),
        });
      }

      await tx.jobScheduleCrewMember.delete({
        where: {
          id: assignment.id,
        },
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,

          customerId: job.customerId,

          actorUserId: membership.userId,

          type: CustomerActivityType.SCHEDULE_UPDATED,

          title: 'Crew removed',

          description: `${crewMemberDisplayName(
            crewMember,
          )} was removed from ${schedule.title}.`,

          metadata: {
            jobId: job.id,
            jobName: job.name,

            scheduleId: schedule.id,
            scheduleTitle: schedule.title,

            crewMemberId: crewMember.id,
            crewMemberName: crewMemberDisplayName(crewMember),

            action: 'crew_removed',
          },
        },
        tx,
      );

      return tx.jobSchedule.findUniqueOrThrow({
        where: {
          id: schedule.id,
        },

        select: this.scheduleSelect(),
      });
    });
  }

  async dispatchForUser(
    clerkUserId: string,
    jobId: string,
    scheduleId: string,
    input: DispatchJobScheduleDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const schedule = await this.requireScheduleForJob(
        membership.organizationId,
        jobId,
        scheduleId,
        tx,
      );

      if (schedule.status === JobScheduleStatus.CANCELLED) {
        throw new BadRequestException(
          'Cancelled schedules cannot be dispatched',
        );
      }

      const startAt = new Date(input.startAt);

      const endAt =
        input.endAt !== undefined
          ? input.endAt
            ? new Date(input.endAt)
            : null
          : schedule.endAt;

      this.validateDateRange(startAt, endAt);

      const sourceCrewMemberId = cleanNullableId(input.sourceCrewMemberId);

      const targetCrewMemberId = cleanNullableId(input.targetCrewMemberId);

      const existingAssignments = await tx.jobScheduleCrewMember.findMany({
        where: {
          organizationId: membership.organizationId,
          jobScheduleId: schedule.id,
        },

        select: {
          id: true,
          crewMemberId: true,
        },
      });

      const existingCrewMemberIds = new Set(
        existingAssignments.map((assignment) => assignment.crewMemberId),
      );

      if (
        sourceCrewMemberId &&
        !existingCrewMemberIds.has(sourceCrewMemberId)
      ) {
        throw new BadRequestException(
          'The source crew member is no longer assigned to this schedule',
        );
      }

      const targetCrewMember = targetCrewMemberId
        ? await this.requireCrewMemberForOrganization(
            membership.organizationId,
            targetCrewMemberId,
            tx,
          )
        : null;

      if (targetCrewMember && !targetCrewMember.active) {
        throw new BadRequestException(
          'Inactive crew members cannot be assigned to schedules',
        );
      }

      /*
       * Build the crew set that will exist AFTER the dispatch move.
       *
       * This is important because checking the current assignments first
       * would incorrectly reject a move when the source crew member is
       * being removed as part of the same transaction.
       */
      const resultingCrewMemberIds = new Set(existingCrewMemberIds);

      if (sourceCrewMemberId && sourceCrewMemberId !== targetCrewMemberId) {
        resultingCrewMemberIds.delete(sourceCrewMemberId);
      }

      if (targetCrewMemberId) {
        resultingCrewMemberIds.add(targetCrewMemberId);
      }

      for (const crewMemberId of resultingCrewMemberIds) {
        await this.assertCrewMemberAvailable(
          membership.organizationId,
          crewMemberId,
          schedule.id,
          startAt,
          endAt,
          tx,
        );
      }

      const startChanged = schedule.startAt.getTime() !== startAt.getTime();

      const endChanged =
        (schedule.endAt?.getTime() ?? null) !== (endAt?.getTime() ?? null);

      if (startChanged || endChanged) {
        await tx.jobSchedule.update({
          where: {
            id: schedule.id,
          },

          data: {
            startAt,
            endAt,
          },
        });
      }

      if (sourceCrewMemberId && sourceCrewMemberId !== targetCrewMemberId) {
        const sourceAssignment = existingAssignments.find(
          (assignment) => assignment.crewMemberId === sourceCrewMemberId,
        );

        if (sourceAssignment) {
          await tx.jobScheduleCrewMember.delete({
            where: {
              id: sourceAssignment.id,
            },
          });
        }
      }

      if (
        targetCrewMemberId &&
        !existingCrewMemberIds.has(targetCrewMemberId)
      ) {
        await tx.jobScheduleCrewMember.create({
          data: {
            organizationId: membership.organizationId,

            jobScheduleId: schedule.id,

            crewMemberId: targetCrewMemberId,
          },
        });
      }

      const sourceCrewMember = sourceCrewMemberId
        ? await this.requireCrewMemberForOrganization(
            membership.organizationId,
            sourceCrewMemberId,
            tx,
          )
        : null;

      const crewChanged = sourceCrewMemberId !== targetCrewMemberId;

      if (startChanged || endChanged || crewChanged) {
        await this.activityService.recordCustomerActivity(
          {
            organizationId: membership.organizationId,

            customerId: job.customerId,

            actorUserId: membership.userId,

            type: CustomerActivityType.SCHEDULE_UPDATED,

            title: 'Schedule dispatched',

            description: buildDispatchDescription({
              scheduleTitle: schedule.title,
              jobName: job.name,

              sourceCrewName: sourceCrewMember
                ? crewMemberDisplayName(sourceCrewMember)
                : null,

              targetCrewName: targetCrewMember
                ? crewMemberDisplayName(targetCrewMember)
                : null,

              dateChanged: startChanged || endChanged,
            }),

            metadata: {
              action: 'schedule_dispatched',

              jobId: job.id,
              jobName: job.name,

              scheduleId: schedule.id,
              scheduleTitle: schedule.title,

              oldStartAt: schedule.startAt.toISOString(),

              oldEndAt: schedule.endAt?.toISOString() ?? null,

              newStartAt: startAt.toISOString(),

              newEndAt: endAt?.toISOString() ?? null,

              sourceCrewMemberId,
              sourceCrewMemberName: sourceCrewMember
                ? crewMemberDisplayName(sourceCrewMember)
                : null,

              targetCrewMemberId,
              targetCrewMemberName: targetCrewMember
                ? crewMemberDisplayName(targetCrewMember)
                : null,
            },
          },
          tx,
        );
      }

      return tx.jobSchedule.findUniqueOrThrow({
        where: {
          id: schedule.id,
        },

        select: this.scheduleSelect(),
      });
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

      await this.validateAssignedCrewAvailability(
        membership.organizationId,
        scheduleId,
        existing.startAt,
        existing.endAt,
        tx,
      );

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
    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('Schedule start time is invalid');
    }

    if (endAt && Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('Schedule end time is invalid');
    }

    if (endAt && endAt.getTime() < startAt.getTime()) {
      throw new BadRequestException(
        'Schedule end time cannot be before start time',
      );
    }
  }

  private async validateAssignedCrewAvailability(
    organizationId: string,
    scheduleId: string,
    startAt: Date,
    endAt: Date | null,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const assignments = await client.jobScheduleCrewMember.findMany({
      where: {
        organizationId,
        jobScheduleId: scheduleId,
      },

      select: {
        crewMemberId: true,
      },
    });

    for (const assignment of assignments) {
      await this.assertCrewMemberAvailable(
        organizationId,
        assignment.crewMemberId,
        scheduleId,
        startAt,
        endAt,
        client,
      );
    }
  }

  private async assertCrewMemberAvailable(
    organizationId: string,
    crewMemberId: string,
    scheduleId: string,
    startAt: Date,
    endAt: Date | null,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const conflicts = await client.jobSchedule.findMany({
      where: {
        organizationId,

        id: {
          not: scheduleId,
        },

        status: {
          not: JobScheduleStatus.CANCELLED,
        },

        crewMembers: {
          some: {
            crewMemberId,
          },
        },

        OR: buildOverlapConditions(startAt, endAt),
      },

      orderBy: {
        startAt: 'asc',
      },

      select: {
        id: true,
        title: true,
        startAt: true,
        endAt: true,

        job: {
          select: {
            id: true,
            name: true,
          },
        },
      },

      take: 1,
    });

    const conflict = conflicts[0];

    if (!conflict) {
      return;
    }

    throw new ConflictException(
      `Crew member is already assigned to "${conflict.title}" for ${conflict.job.name} during this time`,
    );
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

  private async requireCrewMemberForOrganization(
    organizationId: string,
    crewMemberId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const crewMember = await client.crewMember.findFirst({
      where: {
        id: crewMemberId,
        organizationId,
      },

      select: {
        id: true,
        organizationId: true,

        firstName: true,
        lastName: true,

        email: true,
        phone: true,

        hourlyCostCents: true,

        active: true,

        createdAt: true,
        updatedAt: true,
      },
    });

    if (!crewMember) {
      throw new NotFoundException('Crew member not found');
    }

    return crewMember;
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

      crewMembers: {
        orderBy: {
          createdAt: 'asc',
        },

        select: {
          id: true,
          createdAt: true,

          crewMember: {
            select: {
              id: true,
              organizationId: true,

              firstName: true,
              lastName: true,

              email: true,
              phone: true,

              hourlyCostCents: true,

              active: true,
            },
          },
        },
      },

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

function buildOverlapConditions(
  startAt: Date,
  endAt: Date | null,
): Prisma.JobScheduleWhereInput[] {
  if (!endAt) {
    return [
      {
        startAt: startAt,
        endAt: null,
      },

      {
        startAt: {
          lte: startAt,
        },
        endAt: {
          gt: startAt,
        },
      },
    ];
  }

  return [
    {
      startAt: {
        gte: startAt,
        lt: endAt,
      },

      endAt: null,
    },

    {
      startAt: {
        lt: endAt,
      },

      endAt: {
        gt: startAt,
      },
    },
  ];
}

function crewMemberDisplayName(crewMember: {
  firstName: string;
  lastName: string | null;
}) {
  return [crewMember.firstName, crewMember.lastName].filter(Boolean).join(' ');
}

function cleanNullableId(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const result = value.trim();

  return result || null;
}

function buildDispatchDescription({
  scheduleTitle,
  jobName,
  sourceCrewName,
  targetCrewName,
  dateChanged,
}: {
  scheduleTitle: string;
  jobName: string;
  sourceCrewName: string | null;
  targetCrewName: string | null;
  dateChanged: boolean;
}) {
  if (sourceCrewName && targetCrewName && sourceCrewName !== targetCrewName) {
    return `${scheduleTitle} for ${jobName} was dispatched from ${sourceCrewName} to ${targetCrewName}.`;
  }

  if (!sourceCrewName && targetCrewName) {
    return `${scheduleTitle} for ${jobName} was assigned to ${targetCrewName}.`;
  }

  if (sourceCrewName && !targetCrewName) {
    return `${scheduleTitle} for ${jobName} was moved to unassigned.`;
  }

  if (dateChanged) {
    return `${scheduleTitle} was rescheduled for ${jobName}.`;
  }

  return `${scheduleTitle} was dispatched for ${jobName}.`;
}

function clean(value: string | undefined): string | undefined {
  const result = value?.trim();

  return result || undefined;
}
