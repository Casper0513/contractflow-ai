import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  db,
  fromPrisma8Timestamp,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { OrganizationMembershipService } from '../auth/organization-membership.service';

import type { CreateJobTimeEntryDto } from './dto/create-job-time-entry.dto';
import type { UpdateJobTimeEntryDto } from './dto/update-job-time-entry.dto';

type OrmSource = typeof db.orm;

type JobTimeEntryRecord = {
  id: string;
  organizationId: string;
  jobId: string;
  crewMemberId: string;
  createdByUserId: string | null;

  startedAt: Parameters<typeof fromPrisma8Timestamp>[0];

  endedAt: Parameters<typeof fromPrisma8Timestamp>[0] | null;

  hourlyCostCents: number;
  laborCostCents: number;
  currency: string;
  notes: string | null;

  createdAt: Parameters<typeof fromPrisma8Timestamp>[0];

  updatedAt: Parameters<typeof fromPrisma8Timestamp>[0];
};

@Injectable()
export class JobTimeEntriesService {
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

    const entries = await db.orm.public.JobTimeEntry.where({
      organizationId: membership.organizationId,
      jobId,
    })
      .select(
        'id',
        'organizationId',
        'jobId',
        'crewMemberId',
        'createdByUserId',
        'startedAt',
        'endedAt',
        'hourlyCostCents',
        'laborCostCents',
        'currency',
        'notes',
        'createdAt',
        'updatedAt',
      )
      .orderBy((model) => model.startedAt.desc())
      .all();

    return Promise.all(
      entries.map((entry) => this.hydrateTimeEntry(db.orm, entry)),
    );
  }

  async getForUser(
    clerkUserId: string,
    jobId: string,
    timeEntryId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const entry = await this.requireTimeEntryForJob(
      membership.organizationId,
      jobId,
      timeEntryId,
    );

    return this.hydrateTimeEntry(db.orm, entry);
  }

  async createForUser(
    clerkUserId: string,
    jobId: string,
    input: CreateJobTimeEntryDto,
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

      const crewMember = await this.requireActiveCrewMemberForOrganization(
        membership.organizationId,
        input.crewMemberId,
        tx.orm,
      );

      if (crewMember.currency !== job.currency) {
        throw new BadRequestException(
          'Crew member hourly cost currency must match the job currency',
        );
      }

      const startedAt = new Date(input.startedAt);

      const endedAt = input.endedAt ? new Date(input.endedAt) : null;

      this.validateDateRange(startedAt, endedAt);

      const laborCostCents = calculateLaborCostCents(
        startedAt,
        endedAt,
        crewMember.hourlyCostCents,
      );

      const now = toPrisma8Timestamp();

      const entry = await tx.orm.public.JobTimeEntry.create({
        organizationId: membership.organizationId,

        jobId,

        crewMemberId: crewMember.id,

        createdByUserId: membership.userId,

        startedAt: toPrisma8Timestamp(startedAt),

        endedAt: endedAt === null ? null : toPrisma8Timestamp(endedAt),

        hourlyCostCents: crewMember.hourlyCostCents,

        laborCostCents,

        currency: job.currency,

        notes: cleanNullable(input.notes),

        createdAt: now,

        updatedAt: now,
      });

      return this.hydrateTimeEntry(tx.orm, entry);
    });
  }

  async updateForUser(
    clerkUserId: string,
    jobId: string,
    timeEntryId: string,
    input: UpdateJobTimeEntryDto,
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

      const existing = await this.requireTimeEntryForJob(
        membership.organizationId,
        jobId,
        timeEntryId,
        tx.orm,
      );

      if (existing.currency !== job.currency) {
        throw new BadRequestException(
          'Job time entry currency does not match the job currency',
        );
      }

      let crewMemberId = existing.crewMemberId;

      let hourlyCostCents = existing.hourlyCostCents;

      if (
        input.crewMemberId !== undefined &&
        input.crewMemberId !== existing.crewMemberId
      ) {
        const crewMember = await this.requireActiveCrewMemberForOrganization(
          membership.organizationId,
          input.crewMemberId,
          tx.orm,
        );

        if (crewMember.currency !== job.currency) {
          throw new BadRequestException(
            'Crew member hourly cost currency must match the job currency',
          );
        }

        crewMemberId = crewMember.id;

        hourlyCostCents = crewMember.hourlyCostCents;
      }

      const existingStartedAt = fromPrisma8Timestamp(existing.startedAt);

      const existingEndedAt =
        existing.endedAt === null
          ? null
          : fromPrisma8Timestamp(existing.endedAt);

      const startedAt =
        input.startedAt !== undefined
          ? new Date(input.startedAt)
          : existingStartedAt;

      const endedAt =
        input.endedAt !== undefined
          ? input.endedAt
            ? new Date(input.endedAt)
            : null
          : existingEndedAt;

      this.validateDateRange(startedAt, endedAt);

      const laborCostCents = calculateLaborCostCents(
        startedAt,
        endedAt,
        hourlyCostCents,
      );

      await tx.orm.public.JobTimeEntry.where({
        id: timeEntryId,
      }).update({
        crewMemberId,

        startedAt: toPrisma8Timestamp(startedAt),

        endedAt: endedAt === null ? null : toPrisma8Timestamp(endedAt),

        hourlyCostCents,

        laborCostCents,

        notes:
          input.notes !== undefined
            ? cleanNullable(input.notes)
            : existing.notes,

        updatedAt: toPrisma8Timestamp(),
      });

      const entry = await this.requireTimeEntryForJob(
        membership.organizationId,
        jobId,
        timeEntryId,
        tx.orm,
      );

      return this.hydrateTimeEntry(tx.orm, entry);
    });
  }

  async deleteForUser(
    clerkUserId: string,
    jobId: string,
    timeEntryId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const existing = await this.requireTimeEntryForJob(
        membership.organizationId,
        jobId,
        timeEntryId,
        tx.orm,
      );

      await tx.orm.public.JobTimeEntry.where({
        id: existing.id,
      }).delete();

      return {
        success: true,
      };
    });
  }

  private validateDateRange(startedAt: Date, endedAt: Date | null) {
    if (Number.isNaN(startedAt.getTime())) {
      throw new BadRequestException('Start time is invalid');
    }

    if (endedAt && Number.isNaN(endedAt.getTime())) {
      throw new BadRequestException('End time is invalid');
    }

    if (endedAt && endedAt.getTime() < startedAt.getTime()) {
      throw new BadRequestException('End time cannot be before start time');
    }
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
      .select('id', 'currency')
      .first();

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  private async requireActiveCrewMemberForOrganization(
    organizationId: string,
    crewMemberId: string,
    orm: OrmSource = db.orm,
  ) {
    const crewMember = await orm.public.CrewMember.where({
      id: crewMemberId,

      organizationId,

      active: true,
    })
      .select(
        'id',
        'firstName',
        'lastName',
        'email',
        'phone',
        'active',
        'hourlyCostCents',
        'currency',
      )
      .first();

    if (!crewMember) {
      throw new NotFoundException('Active crew member not found');
    }

    return crewMember;
  }

  private async requireTimeEntryForJob(
    organizationId: string,
    jobId: string,
    timeEntryId: string,
    orm: OrmSource = db.orm,
  ) {
    const entry = await orm.public.JobTimeEntry.where({
      id: timeEntryId,

      organizationId,

      jobId,
    })
      .select(
        'id',
        'organizationId',
        'jobId',
        'crewMemberId',
        'createdByUserId',
        'startedAt',
        'endedAt',
        'hourlyCostCents',
        'laborCostCents',
        'currency',
        'notes',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!entry) {
      throw new NotFoundException('Job time entry not found');
    }

    return entry;
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }

  private async hydrateTimeEntry(orm: OrmSource, entry: JobTimeEntryRecord) {
    const [crewMember, createdBy] = await Promise.all([
      orm.public.CrewMember.where({
        id: entry.crewMemberId,
      })
        .select('id', 'firstName', 'lastName', 'email', 'phone', 'active')
        .first(),

      entry.createdByUserId === null
        ? Promise.resolve(null)
        : orm.public.User.where({
            id: entry.createdByUserId,
          })
            .select('id', 'firstName', 'lastName', 'email')
            .first(),
    ]);

    return {
      id: entry.id,

      organizationId: entry.organizationId,

      jobId: entry.jobId,

      crewMemberId: entry.crewMemberId,

      createdByUserId: entry.createdByUserId,

      startedAt: fromPrisma8Timestamp(entry.startedAt),

      endedAt:
        entry.endedAt === null ? null : fromPrisma8Timestamp(entry.endedAt),

      hourlyCostCents: entry.hourlyCostCents,

      laborCostCents: entry.laborCostCents,

      currency: entry.currency,

      notes: entry.notes,

      createdAt: fromPrisma8Timestamp(entry.createdAt),

      updatedAt: fromPrisma8Timestamp(entry.updatedAt),

      crewMember,
      createdBy,
    };
  }
}

function calculateLaborCostCents(
  startedAt: Date,
  endedAt: Date | null,
  hourlyCostCents: number,
) {
  if (!endedAt) {
    return 0;
  }

  const durationMs = endedAt.getTime() - startedAt.getTime();

  const durationHours = durationMs / 3_600_000;

  const laborCostCents = Math.round(durationHours * hourlyCostCents);

  if (!Number.isSafeInteger(laborCostCents) || laborCostCents < 0) {
    throw new BadRequestException('Calculated labor cost is invalid');
  }

  return laborCostCents;
}

function cleanNullable(value: string | null | undefined): string | null {
  const result = value?.trim();

  return result || null;
}
