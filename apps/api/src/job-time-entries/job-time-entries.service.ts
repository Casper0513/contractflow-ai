import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, prisma } from '@contractflow/db';

import type { CreateJobTimeEntryDto } from './dto/create-job-time-entry.dto';
import type { UpdateJobTimeEntryDto } from './dto/update-job-time-entry.dto';

@Injectable()
export class JobTimeEntriesService {
  async listForJobForUser(clerkUserId: string, jobId: string) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireJobForOrganization(membership.organizationId, jobId);

    return prisma.jobTimeEntry.findMany({
      where: {
        organizationId: membership.organizationId,
        jobId,
      },

      orderBy: {
        startedAt: 'desc',
      },

      select: this.timeEntrySelect(),
    });
  }

  async getForUser(clerkUserId: string, jobId: string, timeEntryId: string) {
    const membership = await this.getMembership(clerkUserId);

    return this.requireTimeEntryForJob(
      membership.organizationId,
      jobId,
      timeEntryId,
    );
  }

  async createForUser(
    clerkUserId: string,
    jobId: string,
    input: CreateJobTimeEntryDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const crewMember = await this.requireActiveCrewMemberForOrganization(
        membership.organizationId,
        input.crewMemberId,
        tx,
      );

      const startedAt = new Date(input.startedAt);

      const endedAt = input.endedAt ? new Date(input.endedAt) : null;

      this.validateDateRange(startedAt, endedAt);

      const laborCostCents = calculateLaborCostCents(
        startedAt,
        endedAt,
        crewMember.hourlyCostCents,
      );

      return tx.jobTimeEntry.create({
        data: {
          organizationId: membership.organizationId,

          jobId,

          crewMemberId: crewMember.id,

          createdByUserId: membership.userId,

          startedAt,

          endedAt,

          hourlyCostCents: crewMember.hourlyCostCents,

          laborCostCents,

          notes: clean(input.notes),
        },

        select: this.timeEntrySelect(),
      });
    });
  }

  async updateForUser(
    clerkUserId: string,
    jobId: string,
    timeEntryId: string,
    input: UpdateJobTimeEntryDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const existing = await this.requireTimeEntryForJob(
        membership.organizationId,
        jobId,
        timeEntryId,
        tx,
      );

      let crewMemberId = existing.crewMemberId;

      let hourlyCostCents = existing.hourlyCostCents;

      if (
        input.crewMemberId !== undefined &&
        input.crewMemberId !== existing.crewMemberId
      ) {
        const crewMember = await this.requireActiveCrewMemberForOrganization(
          membership.organizationId,
          input.crewMemberId,
          tx,
        );

        crewMemberId = crewMember.id;

        hourlyCostCents = crewMember.hourlyCostCents;
      }

      const startedAt =
        input.startedAt !== undefined
          ? new Date(input.startedAt)
          : existing.startedAt;

      const endedAt =
        input.endedAt !== undefined
          ? input.endedAt
            ? new Date(input.endedAt)
            : null
          : existing.endedAt;

      this.validateDateRange(startedAt, endedAt);

      const laborCostCents = calculateLaborCostCents(
        startedAt,
        endedAt,
        hourlyCostCents,
      );

      return tx.jobTimeEntry.update({
        where: {
          id: timeEntryId,
        },

        data: {
          crewMemberId,

          startedAt,

          endedAt,

          hourlyCostCents,

          laborCostCents,

          notes:
            input.notes !== undefined
              ? cleanNullable(input.notes)
              : existing.notes,
        },

        select: this.timeEntrySelect(),
      });
    });
  }

  async deleteForUser(clerkUserId: string, jobId: string, timeEntryId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const existing = await this.requireTimeEntryForJob(
        membership.organizationId,
        jobId,
        timeEntryId,
        tx,
      );

      await tx.jobTimeEntry.delete({
        where: {
          id: existing.id,
        },
      });

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
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const job = await client.job.findFirst({
      where: {
        id: jobId,
        organizationId,
      },

      select: {
        id: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  private async requireActiveCrewMemberForOrganization(
    organizationId: string,
    crewMemberId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const crewMember = await client.crewMember.findFirst({
      where: {
        id: crewMemberId,
        organizationId,
        active: true,
      },

      select: {
        id: true,
        hourlyCostCents: true,
      },
    });

    if (!crewMember) {
      throw new NotFoundException('Active crew member not found');
    }

    return crewMember;
  }

  private async requireTimeEntryForJob(
    organizationId: string,
    jobId: string,
    timeEntryId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const timeEntry = await client.jobTimeEntry.findFirst({
      where: {
        id: timeEntryId,
        organizationId,
        jobId,
      },

      select: this.timeEntrySelect(),
    });

    if (!timeEntry) {
      throw new NotFoundException('Job time entry not found');
    }

    return timeEntry;
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

  private timeEntrySelect(): Prisma.JobTimeEntrySelect {
    return {
      id: true,
      organizationId: true,
      jobId: true,
      crewMemberId: true,
      createdByUserId: true,

      startedAt: true,
      endedAt: true,

      hourlyCostCents: true,
      laborCostCents: true,

      notes: true,

      createdAt: true,
      updatedAt: true,

      crewMember: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          active: true,
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

function clean(value: string | undefined): string | undefined {
  const result = value?.trim();

  return result || undefined;
}

function cleanNullable(value: string | null | undefined): string | null {
  const result = value?.trim();

  return result || null;
}
