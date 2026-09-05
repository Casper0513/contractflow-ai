import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type DatabaseTransaction,
  db,
  fromPrisma8Timestamp,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { OrganizationMembershipService } from '../auth/organization-membership.service';

import type { CreateJobScheduleDto } from './dto/create-job-schedule.dto';
import type { DispatchJobScheduleDto } from './dto/dispatch-job-schedule.dto';
import type { ScheduleBacklogJobDto } from './dto/schedule-backlog-job.dto';
import type { UpdateJobScheduleDto } from './dto/update-job-schedule.dto';

type OrmSource = typeof db.orm;

type ScheduleStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

type ScheduleType =
  | 'WORK'
  | 'SITE_VISIT'
  | 'ESTIMATE'
  | 'INSPECTION'
  | 'DELIVERY'
  | 'MEETING'
  | 'OTHER';

type Timestamp = Parameters<typeof fromPrisma8Timestamp>[0];

type ScheduleRecord = {
  id: string;
  organizationId: string;
  jobId: string;
  createdByUserId: string | null;

  _type: ScheduleType;
  status: ScheduleStatus;

  title: string;
  description: string | null;

  startAt: Timestamp;
  endAt: Timestamp | null;

  allDay: boolean;

  location: string | null;
  notes: string | null;

  cancelledAt: Timestamp | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type ScheduleChangeMap = Record<
  string,
  {
    oldValue: string | boolean | null;

    newValue: string | boolean | null;
  }
>;

type ActivityMetadata = Parameters<
  DatabaseTransaction['orm']['public']['CustomerActivity']['create']
>[0]['metadata'];

@Injectable()
export class JobSchedulesService {
  constructor(
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async listForJobForUser(
    clerkUserId: string,
    jobId: string,
    includeCancelled = false,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    await this.requireJobForOrganization(membership.organizationId, jobId);

    const schedules = await db.orm.public.JobSchedule.where({
      organizationId: membership.organizationId,

      jobId,
    })
      .select(
        'id',
        'organizationId',
        'jobId',
        'createdByUserId',
        '_type',
        'status',
        'title',
        'description',
        'startAt',
        'endAt',
        'allDay',
        'location',
        'notes',
        'cancelledAt',
        'createdAt',
        'updatedAt',
      )
      .orderBy((model) => model.startAt.asc())
      .all();

    const visible = includeCancelled
      ? schedules
      : schedules.filter((schedule) => schedule.status !== 'CANCELLED');

    return Promise.all(
      visible.map((schedule) => this.hydrateSchedule(db.orm, schedule)),
    );
  }

  async listForOrganizationForUser(
    clerkUserId: string,
    options?: {
      from?: string;
      to?: string;
      includeCancelled?: boolean;
      crewMemberId?: string;
    },
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

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

    let crewScheduleIds: Set<string> | null = null;

    if (options?.crewMemberId) {
      await this.requireCrewMemberForOrganization(
        membership.organizationId,
        options.crewMemberId,
      );

      const assignments = await db.orm.public.JobScheduleCrewMember.where({
        organizationId: membership.organizationId,

        crewMemberId: options.crewMemberId,
      })
        .select('jobScheduleId')
        .all();

      crewScheduleIds = new Set(
        assignments.map((assignment) => assignment.jobScheduleId),
      );
    }

    const schedules = await db.orm.public.JobSchedule.where({
      organizationId: membership.organizationId,
    })
      .select(
        'id',
        'organizationId',
        'jobId',
        'createdByUserId',
        '_type',
        'status',
        'title',
        'description',
        'startAt',
        'endAt',
        'allDay',
        'location',
        'notes',
        'cancelledAt',
        'createdAt',
        'updatedAt',
      )
      .orderBy((model) => model.startAt.asc())
      .all();

    const filtered = schedules.filter((schedule) => {
      if (!options?.includeCancelled && schedule.status === 'CANCELLED') {
        return false;
      }

      if (crewScheduleIds && !crewScheduleIds.has(schedule.id)) {
        return false;
      }

      const startAt = fromPrisma8Timestamp(schedule.startAt);

      const endAt =
        schedule.endAt === null ? null : fromPrisma8Timestamp(schedule.endAt);

      if (from && to) {
        return (
          (startAt.getTime() >= from.getTime() &&
            startAt.getTime() <= to.getTime()) ||
          (startAt.getTime() < from.getTime() &&
            endAt !== null &&
            endAt.getTime() > from.getTime())
        );
      }

      if (from) {
        return (
          startAt.getTime() >= from.getTime() ||
          (endAt !== null && endAt.getTime() > from.getTime())
        );
      }

      if (to) {
        return startAt.getTime() <= to.getTime();
      }

      return true;
    });

    return Promise.all(
      filtered.map((schedule) => this.hydrateSchedule(db.orm, schedule)),
    );
  }

  async scheduleBacklogJobForUser(
    clerkUserId: string,
    jobId: string,
    input: ScheduleBacklogJobDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const job = await tx.orm.public.Job.where({
        id: jobId,

        organizationId: membership.organizationId,
      })
        .select(
          'id',
          'customerId',
          'name',
          'status',
          'archivedAt',
          'addressLine1',
          'addressLine2',
          'city',
          'province',
          'postalCode',
        )
        .first();

      if (
        !job ||
        job.archivedAt !== null ||
        (job.status !== 'APPROVED' &&
          job.status !== 'SCHEDULED' &&
          job.status !== 'IN_PROGRESS')
      ) {
        throw new NotFoundException('Job is not available for dispatch');
      }

      const schedules = await tx.orm.public.JobSchedule.where({
        organizationId: membership.organizationId,

        jobId: job.id,
      })
        .select('id', 'status')
        .all();

      const activeSchedule = schedules.find(
        (schedule) =>
          schedule.status === 'SCHEDULED' || schedule.status === 'IN_PROGRESS',
      );

      if (activeSchedule) {
        throw new ConflictException(
          'This job already has an active schedule event',
        );
      }

      const dispatchSettings = await tx.orm.public.DispatchSettings.where({
        organizationId: membership.organizationId,
      })
        .select('defaultDurationMinutes', 'defaultScheduleType')
        .first();

      const defaultDurationMinutes =
        dispatchSettings?.defaultDurationMinutes ?? 60;

      const defaultScheduleType =
        dispatchSettings?.defaultScheduleType ?? 'WORK';

      const startAt = new Date(input.startAt);

      const endAt = new Date(
        startAt.getTime() + defaultDurationMinutes * 60_000,
      );

      this.validateDateRange(startAt, endAt);

      const crewMemberId = cleanNullableId(input.crewMemberId);

      const crewMember = crewMemberId
        ? await this.requireCrewMemberForOrganization(
            membership.organizationId,
            crewMemberId,
            tx.orm,
          )
        : null;

      if (crewMember && !crewMember.active) {
        throw new BadRequestException(
          'Inactive crew members cannot be assigned to schedules',
        );
      }

      if (crewMember) {
        await this.assertCrewMemberAvailable(
          membership.organizationId,
          crewMember.id,
          '__new_schedule__',
          startAt,
          endAt,
          tx.orm,
        );
      }

      const location = [
        job.addressLine1,
        job.addressLine2,
        [job.city, job.province, job.postalCode].filter(Boolean).join(', '),
      ]
        .filter(Boolean)
        .join(', ');

      const now = toPrisma8Timestamp();

      const schedule = await tx.orm.public.JobSchedule.create({
        organizationId: membership.organizationId,

        jobId: job.id,

        createdByUserId: membership.userId,

        _type: defaultScheduleType,

        status: 'SCHEDULED',

        title: job.name,

        description: null,

        startAt: toPrisma8Timestamp(startAt),

        endAt: toPrisma8Timestamp(endAt),

        allDay: false,

        location: location || null,

        notes: null,

        cancelledAt: null,

        createdAt: now,

        updatedAt: now,
      });

      if (crewMember) {
        await tx.orm.public.JobScheduleCrewMember.create({
          organizationId: membership.organizationId,

          jobScheduleId: schedule.id,

          crewMemberId: crewMember.id,

          createdAt: toPrisma8Timestamp(),
        });
      }

      if (job.status === 'APPROVED') {
        await tx.orm.public.Job.where({
          id: job.id,
        }).update({
          status: 'SCHEDULED',

          updatedAt: toPrisma8Timestamp(),
        });
      }

      await this.recordActivity(tx, {
        organizationId: membership.organizationId,

        customerId: job.customerId,

        actorUserId: membership.userId,

        type: 'SCHEDULE_CREATED',

        title: 'Job dispatched',

        description: crewMember
          ? `${job.name} was scheduled and assigned to ${crewMemberDisplayName(
              crewMember,
            )}.`
          : `${job.name} was scheduled without a crew assignment.`,

        metadata: {
          action: 'backlog_job_dispatched',

          jobId: job.id,

          jobName: job.name,

          scheduleId: schedule.id,

          scheduleTitle: schedule.title,

          scheduleType: schedule._type,

          startAt: startAt.toISOString(),

          endAt: endAt.toISOString(),

          defaultDurationMinutes,

          crewMemberId: crewMember?.id ?? null,

          crewMemberName: crewMember ? crewMemberDisplayName(crewMember) : null,

          previousJobStatus: job.status,

          newJobStatus: job.status === 'APPROVED' ? 'SCHEDULED' : job.status,
        },
      });

      return this.hydrateSchedule(tx.orm, schedule);
    });
  }

  async createForUser(
    clerkUserId: string,
    jobId: string,
    input: CreateJobScheduleDto,
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

      const startAt = new Date(input.startAt);

      const endAt = input.endAt ? new Date(input.endAt) : null;

      this.validateDateRange(startAt, endAt);

      const status = input.status ?? 'SCHEDULED';

      const type = input.type ?? 'WORK';

      const now = toPrisma8Timestamp();

      const schedule = await tx.orm.public.JobSchedule.create({
        organizationId: membership.organizationId,

        jobId,

        createdByUserId: membership.userId,

        _type: type,

        status,

        title: input.title.trim(),

        description: clean(input.description) ?? null,

        startAt: toPrisma8Timestamp(startAt),

        endAt: endAt === null ? null : toPrisma8Timestamp(endAt),

        allDay: input.allDay ?? false,

        location: clean(input.location) ?? null,

        notes: clean(input.notes) ?? null,

        cancelledAt: status === 'CANCELLED' ? toPrisma8Timestamp() : null,

        createdAt: now,

        updatedAt: now,
      });

      await this.recordActivity(tx, {
        organizationId: membership.organizationId,

        customerId: job.customerId,

        actorUserId: membership.userId,

        type: 'SCHEDULE_CREATED',

        title: 'Schedule created',

        description: `${schedule.title} was scheduled for ${job.name}.`,

        metadata: {
          jobId: job.id,

          jobName: job.name,

          scheduleId: schedule.id,

          scheduleTitle: schedule.title,

          scheduleType: schedule._type,

          startAt: startAt.toISOString(),

          endAt: endAt?.toISOString() ?? null,
        },
      });

      return this.hydrateSchedule(tx.orm, schedule);
    });
  }

  async updateForUser(
    clerkUserId: string,
    jobId: string,
    scheduleId: string,
    input: UpdateJobScheduleDto,
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

      const existing = await this.requireScheduleForJob(
        membership.organizationId,
        jobId,
        scheduleId,
        tx.orm,
      );

      const existingStartAt = fromPrisma8Timestamp(existing.startAt);

      const existingEndAt =
        existing.endAt === null ? null : fromPrisma8Timestamp(existing.endAt);

      const nextValues = {
        title: input.title !== undefined ? input.title.trim() : existing.title,

        description:
          input.description !== undefined
            ? (clean(input.description) ?? null)
            : existing.description,

        type: input.type !== undefined ? input.type : existing._type,

        status: input.status !== undefined ? input.status : existing.status,

        startAt:
          input.startAt !== undefined
            ? new Date(input.startAt)
            : existingStartAt,

        endAt:
          input.endAt !== undefined
            ? input.endAt
              ? new Date(input.endAt)
              : null
            : existingEndAt,

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

      if (nextValues.status !== 'CANCELLED') {
        await this.validateAssignedCrewAvailability(
          membership.organizationId,
          scheduleId,
          nextValues.startAt,
          nextValues.endAt,
          tx.orm,
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

      addChange(changes, 'type', existing._type, nextValues.type);

      addChange(changes, 'status', existing.status, nextValues.status);

      addDateChange(changes, 'startAt', existingStartAt, nextValues.startAt);

      addDateChange(changes, 'endAt', existingEndAt, nextValues.endAt);

      addBooleanChange(changes, 'allDay', existing.allDay, nextValues.allDay);

      addChange(changes, 'location', existing.location, nextValues.location);

      addChange(changes, 'notes', existing.notes, nextValues.notes);

      let cancelledAt = existing.cancelledAt;

      if (
        nextValues.status === 'CANCELLED' &&
        existing.status !== 'CANCELLED'
      ) {
        cancelledAt = toPrisma8Timestamp();
      }

      if (
        nextValues.status !== 'CANCELLED' &&
        existing.status === 'CANCELLED'
      ) {
        cancelledAt = null;
      }

      await tx.orm.public.JobSchedule.where({
        id: scheduleId,
      }).update({
        title: nextValues.title,

        description: nextValues.description,

        _type: nextValues.type,

        status: nextValues.status,

        startAt: toPrisma8Timestamp(nextValues.startAt),

        endAt:
          nextValues.endAt === null
            ? null
            : toPrisma8Timestamp(nextValues.endAt),

        allDay: nextValues.allDay,

        location: nextValues.location,

        notes: nextValues.notes,

        cancelledAt,

        updatedAt: toPrisma8Timestamp(),
      });

      const schedule = await this.requireScheduleForJob(
        membership.organizationId,
        jobId,
        scheduleId,
        tx.orm,
      );

      if (Object.keys(changes).length > 0) {
        await this.recordActivity(tx, {
          organizationId: membership.organizationId,

          customerId: job.customerId,

          actorUserId: membership.userId,

          type: 'SCHEDULE_UPDATED',

          title: 'Schedule updated',

          description: `${schedule.title} was updated for ${job.name}.`,

          metadata: {
            jobId: job.id,

            jobName: job.name,

            scheduleId: schedule.id,

            scheduleTitle: schedule.title,

            changes,
          },
        });
      }

      return this.hydrateSchedule(tx.orm, schedule);
    });
  }

  async assignCrewMemberForUser(
    clerkUserId: string,
    jobId: string,
    scheduleId: string,
    crewMemberId: string,
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

      const schedule = await this.requireScheduleForJob(
        membership.organizationId,
        jobId,
        scheduleId,
        tx.orm,
      );

      if (schedule.status === 'CANCELLED') {
        throw new BadRequestException(
          'Crew cannot be assigned to a cancelled schedule',
        );
      }

      const crewMember = await this.requireCrewMemberForOrganization(
        membership.organizationId,
        crewMemberId,
        tx.orm,
      );

      if (!crewMember.active) {
        throw new BadRequestException(
          'Inactive crew members cannot be assigned to schedules',
        );
      }

      const existingAssignment =
        await tx.orm.public.JobScheduleCrewMember.where({
          jobScheduleId: schedule.id,

          crewMemberId: crewMember.id,
        })
          .select('id')
          .first();

      if (existingAssignment) {
        return this.hydrateSchedule(tx.orm, schedule);
      }

      await this.assertCrewMemberAvailable(
        membership.organizationId,
        crewMember.id,
        schedule.id,
        fromPrisma8Timestamp(schedule.startAt),
        schedule.endAt === null ? null : fromPrisma8Timestamp(schedule.endAt),
        tx.orm,
      );

      await tx.orm.public.JobScheduleCrewMember.create({
        organizationId: membership.organizationId,

        jobScheduleId: schedule.id,

        crewMemberId: crewMember.id,

        createdAt: toPrisma8Timestamp(),
      });

      await this.recordActivity(tx, {
        organizationId: membership.organizationId,

        customerId: job.customerId,

        actorUserId: membership.userId,

        type: 'SCHEDULE_UPDATED',

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
      });

      return this.hydrateSchedule(tx.orm, schedule);
    });
  }

  async removeCrewMemberForUser(
    clerkUserId: string,
    jobId: string,
    scheduleId: string,
    crewMemberId: string,
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

      const schedule = await this.requireScheduleForJob(
        membership.organizationId,
        jobId,
        scheduleId,
        tx.orm,
      );

      const crewMember = await this.requireCrewMemberForOrganization(
        membership.organizationId,
        crewMemberId,
        tx.orm,
      );

      const assignment = await tx.orm.public.JobScheduleCrewMember.where({
        jobScheduleId: schedule.id,

        crewMemberId: crewMember.id,
      })
        .select('id')
        .first();

      if (!assignment) {
        return this.hydrateSchedule(tx.orm, schedule);
      }

      await tx.orm.public.JobScheduleCrewMember.where({
        id: assignment.id,
      }).delete();

      await this.recordActivity(tx, {
        organizationId: membership.organizationId,

        customerId: job.customerId,

        actorUserId: membership.userId,

        type: 'SCHEDULE_UPDATED',

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
      });

      return this.hydrateSchedule(tx.orm, schedule);
    });
  }

  async dispatchForUser(
    clerkUserId: string,
    jobId: string,
    scheduleId: string,
    input: DispatchJobScheduleDto,
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

      const schedule = await this.requireScheduleForJob(
        membership.organizationId,
        jobId,
        scheduleId,
        tx.orm,
      );

      if (schedule.status === 'CANCELLED') {
        throw new BadRequestException(
          'Cancelled schedules cannot be dispatched',
        );
      }

      const oldStartAt = fromPrisma8Timestamp(schedule.startAt);

      const oldEndAt =
        schedule.endAt === null ? null : fromPrisma8Timestamp(schedule.endAt);

      const startAt = new Date(input.startAt);

      const endAt =
        input.endAt !== undefined
          ? input.endAt
            ? new Date(input.endAt)
            : null
          : oldEndAt;

      this.validateDateRange(startAt, endAt);

      const sourceCrewMemberId = cleanNullableId(input.sourceCrewMemberId);

      const targetCrewMemberId = cleanNullableId(input.targetCrewMemberId);

      const existingAssignments =
        await tx.orm.public.JobScheduleCrewMember.where({
          organizationId: membership.organizationId,

          jobScheduleId: schedule.id,
        })
          .select('id', 'crewMemberId')
          .all();

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
            tx.orm,
          )
        : null;

      if (targetCrewMember && !targetCrewMember.active) {
        throw new BadRequestException(
          'Inactive crew members cannot be assigned to schedules',
        );
      }

      const resultingCrewMemberIds = new Set(existingCrewMemberIds);

      if (sourceCrewMemberId && sourceCrewMemberId !== targetCrewMemberId) {
        resultingCrewMemberIds.delete(sourceCrewMemberId);
      }

      if (targetCrewMemberId) {
        resultingCrewMemberIds.add(targetCrewMemberId);
      }

      for (const resultingCrewMemberId of resultingCrewMemberIds) {
        await this.assertCrewMemberAvailable(
          membership.organizationId,
          resultingCrewMemberId,
          schedule.id,
          startAt,
          endAt,
          tx.orm,
        );
      }

      const startChanged = oldStartAt.getTime() !== startAt.getTime();

      const endChanged =
        (oldEndAt?.getTime() ?? null) !== (endAt?.getTime() ?? null);

      if (startChanged || endChanged) {
        await tx.orm.public.JobSchedule.where({
          id: schedule.id,
        }).update({
          startAt: toPrisma8Timestamp(startAt),

          endAt: endAt === null ? null : toPrisma8Timestamp(endAt),

          updatedAt: toPrisma8Timestamp(),
        });
      }

      if (sourceCrewMemberId && sourceCrewMemberId !== targetCrewMemberId) {
        const sourceAssignment = existingAssignments.find(
          (assignment) => assignment.crewMemberId === sourceCrewMemberId,
        );

        if (sourceAssignment) {
          await tx.orm.public.JobScheduleCrewMember.where({
            id: sourceAssignment.id,
          }).delete();
        }
      }

      if (
        targetCrewMemberId &&
        !existingCrewMemberIds.has(targetCrewMemberId)
      ) {
        await tx.orm.public.JobScheduleCrewMember.create({
          organizationId: membership.organizationId,

          jobScheduleId: schedule.id,

          crewMemberId: targetCrewMemberId,

          createdAt: toPrisma8Timestamp(),
        });
      }

      const sourceCrewMember = sourceCrewMemberId
        ? await this.requireCrewMemberForOrganization(
            membership.organizationId,
            sourceCrewMemberId,
            tx.orm,
          )
        : null;

      const crewChanged = sourceCrewMemberId !== targetCrewMemberId;

      if (startChanged || endChanged || crewChanged) {
        await this.recordActivity(tx, {
          organizationId: membership.organizationId,

          customerId: job.customerId,

          actorUserId: membership.userId,

          type: 'SCHEDULE_UPDATED',

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

            oldStartAt: oldStartAt.toISOString(),

            oldEndAt: oldEndAt?.toISOString() ?? null,

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
        });
      }

      const updated = await this.requireScheduleForJob(
        membership.organizationId,
        jobId,
        scheduleId,
        tx.orm,
      );

      return this.hydrateSchedule(tx.orm, updated);
    });
  }

  async cancelForUser(
    clerkUserId: string,
    jobId: string,
    scheduleId: string,
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

      const existing = await this.requireScheduleForJob(
        membership.organizationId,
        jobId,
        scheduleId,
        tx.orm,
      );

      if (existing.status === 'CANCELLED') {
        return this.hydrateSchedule(tx.orm, existing);
      }

      await tx.orm.public.JobSchedule.where({
        id: scheduleId,
      }).update({
        status: 'CANCELLED',

        cancelledAt: toPrisma8Timestamp(),

        updatedAt: toPrisma8Timestamp(),
      });

      const schedule = await this.requireScheduleForJob(
        membership.organizationId,
        jobId,
        scheduleId,
        tx.orm,
      );

      const startAt = fromPrisma8Timestamp(schedule.startAt);

      await this.recordActivity(tx, {
        organizationId: membership.organizationId,

        customerId: job.customerId,

        actorUserId: membership.userId,

        type: 'SCHEDULE_CANCELLED',

        title: 'Schedule cancelled',

        description: `${schedule.title} was cancelled for ${job.name}.`,

        metadata: {
          jobId: job.id,

          jobName: job.name,

          scheduleId: schedule.id,

          scheduleTitle: schedule.title,

          startAt: startAt.toISOString(),
        },
      });

      return this.hydrateSchedule(tx.orm, schedule);
    });
  }

  async restoreForUser(
    clerkUserId: string,
    jobId: string,
    scheduleId: string,
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

      const existing = await this.requireScheduleForJob(
        membership.organizationId,
        jobId,
        scheduleId,
        tx.orm,
      );

      if (existing.status !== 'CANCELLED') {
        return this.hydrateSchedule(tx.orm, existing);
      }

      const startAt = fromPrisma8Timestamp(existing.startAt);

      const endAt =
        existing.endAt === null ? null : fromPrisma8Timestamp(existing.endAt);

      await this.validateAssignedCrewAvailability(
        membership.organizationId,
        scheduleId,
        startAt,
        endAt,
        tx.orm,
      );

      await tx.orm.public.JobSchedule.where({
        id: scheduleId,
      }).update({
        status: 'SCHEDULED',

        cancelledAt: null,

        updatedAt: toPrisma8Timestamp(),
      });

      const schedule = await this.requireScheduleForJob(
        membership.organizationId,
        jobId,
        scheduleId,
        tx.orm,
      );

      await this.recordActivity(tx, {
        organizationId: membership.organizationId,

        customerId: job.customerId,

        actorUserId: membership.userId,

        type: 'SCHEDULE_RESTORED',

        title: 'Schedule restored',

        description: `${schedule.title} was restored for ${job.name}.`,

        metadata: {
          jobId: job.id,

          jobName: job.name,

          scheduleId: schedule.id,

          scheduleTitle: schedule.title,

          startAt: startAt.toISOString(),
        },
      });

      return this.hydrateSchedule(tx.orm, schedule);
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
    orm: OrmSource = db.orm,
  ) {
    const assignments = await orm.public.JobScheduleCrewMember.where({
      organizationId,
      jobScheduleId: scheduleId,
    })
      .select('crewMemberId')
      .all();

    for (const assignment of assignments) {
      await this.assertCrewMemberAvailable(
        organizationId,
        assignment.crewMemberId,
        scheduleId,
        startAt,
        endAt,
        orm,
      );
    }
  }

  private async assertCrewMemberAvailable(
    organizationId: string,
    crewMemberId: string,
    scheduleId: string,
    startAt: Date,
    endAt: Date | null,
    orm: OrmSource = db.orm,
  ) {
    const assignments = await orm.public.JobScheduleCrewMember.where({
      organizationId,
      crewMemberId,
    })
      .select('jobScheduleId')
      .all();

    const conflicts: Array<{
      id: string;
      jobId: string;
      title: string;
      startAt: Date;
      endAt: Date | null;
    }> = [];

    for (const assignment of assignments) {
      if (assignment.jobScheduleId === scheduleId) {
        continue;
      }

      const candidate = await orm.public.JobSchedule.where({
        id: assignment.jobScheduleId,

        organizationId,
      })
        .select('id', 'jobId', 'title', 'status', 'startAt', 'endAt')
        .first();

      if (!candidate || candidate.status === 'CANCELLED') {
        continue;
      }

      const candidateStart = fromPrisma8Timestamp(candidate.startAt);

      const candidateEnd =
        candidate.endAt === null ? null : fromPrisma8Timestamp(candidate.endAt);

      if (schedulesOverlap(candidateStart, candidateEnd, startAt, endAt)) {
        conflicts.push({
          id: candidate.id,

          jobId: candidate.jobId,

          title: candidate.title,

          startAt: candidateStart,

          endAt: candidateEnd,
        });
      }
    }

    conflicts.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    const conflict = conflicts[0];

    if (!conflict) {
      return;
    }

    const conflictJob = await orm.public.Job.where({
      id: conflict.jobId,
    })
      .select('id', 'name')
      .first();

    throw new ConflictException(
      `Crew member is already assigned to "${conflict.title}" for ${
        conflictJob?.name ?? 'this job'
      } during this time`,
    );
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

  private async requireScheduleForJob(
    organizationId: string,
    jobId: string,
    scheduleId: string,
    orm: OrmSource = db.orm,
  ) {
    const schedule = await orm.public.JobSchedule.where({
      id: scheduleId,

      jobId,

      organizationId,
    })
      .select(
        'id',
        'organizationId',
        'jobId',
        'createdByUserId',
        '_type',
        'status',
        'title',
        'description',
        'startAt',
        'endAt',
        'allDay',
        'location',
        'notes',
        'cancelledAt',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!schedule) {
      throw new NotFoundException('Schedule event not found');
    }

    return schedule;
  }

  private async requireCrewMemberForOrganization(
    organizationId: string,
    crewMemberId: string,
    orm: OrmSource = db.orm,
  ) {
    const crewMember = await orm.public.CrewMember.where({
      id: crewMemberId,

      organizationId,
    })
      .select(
        'id',
        'organizationId',
        'firstName',
        'lastName',
        'email',
        'phone',
        'hourlyCostCents',
        'currency',
        'active',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!crewMember) {
      throw new NotFoundException('Crew member not found');
    }

    return crewMember;
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }

  private async hydrateSchedule(orm: OrmSource, schedule: ScheduleRecord) {
    const [assignments, job, createdBy] = await Promise.all([
      orm.public.JobScheduleCrewMember.where({
        organizationId: schedule.organizationId,

        jobScheduleId: schedule.id,
      })
        .select('id', 'crewMemberId', 'createdAt')
        .orderBy((model) => model.createdAt.asc())
        .all(),

      orm.public.Job.where({
        id: schedule.jobId,
      })
        .select('id', 'name', 'customerId')
        .first(),

      schedule.createdByUserId === null
        ? Promise.resolve(null)
        : orm.public.User.where({
            id: schedule.createdByUserId,
          })
            .select('id', 'firstName', 'lastName', 'email')
            .first(),
    ]);

    const crewMembers = await Promise.all(
      assignments.map(async (assignment) => {
        const crewMember = await orm.public.CrewMember.where({
          id: assignment.crewMemberId,
        })
          .select(
            'id',
            'organizationId',
            'firstName',
            'lastName',
            'email',
            'phone',
            'hourlyCostCents',
            'currency',
            'active',
          )
          .first();

        return {
          id: assignment.id,

          createdAt: fromPrisma8Timestamp(assignment.createdAt),

          crewMember,
        };
      }),
    );

    const customer =
      job === null
        ? null
        : await orm.public.Customer.where({
            id: job.customerId,
          })
            .select('id', 'firstName', 'lastName', 'companyName')
            .first();

    return {
      id: schedule.id,

      organizationId: schedule.organizationId,

      jobId: schedule.jobId,

      createdByUserId: schedule.createdByUserId,

      type: schedule._type,

      status: schedule.status,

      title: schedule.title,

      description: schedule.description,

      startAt: fromPrisma8Timestamp(schedule.startAt),

      endAt:
        schedule.endAt === null ? null : fromPrisma8Timestamp(schedule.endAt),

      allDay: schedule.allDay,

      location: schedule.location,

      notes: schedule.notes,

      cancelledAt:
        schedule.cancelledAt === null
          ? null
          : fromPrisma8Timestamp(schedule.cancelledAt),

      createdAt: fromPrisma8Timestamp(schedule.createdAt),

      updatedAt: fromPrisma8Timestamp(schedule.updatedAt),

      crewMembers,

      job:
        job === null
          ? null
          : {
              id: job.id,

              name: job.name,

              customer,
            },

      createdBy,
    };
  }

  private async recordActivity(
    tx: DatabaseTransaction,
    input: {
      organizationId: string;
      customerId: string;
      actorUserId: string;

      type:
        | 'SCHEDULE_CREATED'
        | 'SCHEDULE_UPDATED'
        | 'SCHEDULE_CANCELLED'
        | 'SCHEDULE_RESTORED';

      title: string;
      description: string;

      metadata: ActivityMetadata;
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
}

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

function schedulesOverlap(
  existingStart: Date,
  existingEnd: Date | null,
  startAt: Date,
  endAt: Date | null,
) {
  if (!endAt) {
    return (
      (existingStart.getTime() === startAt.getTime() && existingEnd === null) ||
      (existingStart.getTime() <= startAt.getTime() &&
        existingEnd !== null &&
        existingEnd.getTime() > startAt.getTime())
    );
  }

  return (
    (existingStart.getTime() >= startAt.getTime() &&
      existingStart.getTime() < endAt.getTime() &&
      existingEnd === null) ||
    (existingStart.getTime() < endAt.getTime() &&
      existingEnd !== null &&
      existingEnd.getTime() > startAt.getTime())
  );
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
