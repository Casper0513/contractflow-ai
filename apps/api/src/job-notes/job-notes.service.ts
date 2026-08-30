import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerActivityType, Prisma, prisma } from '@contractflow/db';

import { OrganizationMembershipService } from '../auth/organization-membership.service';

import { ActivityService } from '../activity/activity.service';
import type { CreateJobNoteDto } from './dto/create-job-note.dto';
import type { UpdateJobNoteDto } from './dto/update-job-note.dto';

@Injectable()
export class JobNotesService {
  constructor(
    private readonly activityService: ActivityService,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async listForJobForUser(clerkUserId: string, jobId: string) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireJobForOrganization(membership.organizationId, jobId);

    return prisma.jobNote.findMany({
      where: {
        organizationId: membership.organizationId,
        jobId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: this.noteSelect(),
    });
  }

  async createForUser(
    clerkUserId: string,
    jobId: string,
    input: CreateJobNoteDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const note = await tx.jobNote.create({
        data: {
          organizationId: membership.organizationId,
          jobId,
          createdByUserId: membership.userId,
          content: input.content.trim(),
        },
        select: this.noteSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.NOTE_ADDED,
          title: 'Job note added',
          description: `A note was added to ${job.name}.`,
          metadata: {
            jobId,
            jobName: job.name,
            noteId: note.id,
          },
        },
        tx,
      );

      return note;
    });
  }

  async updateForUser(
    clerkUserId: string,
    jobId: string,
    noteId: string,
    input: UpdateJobNoteDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      await this.requireNoteForJob(
        membership.organizationId,
        jobId,
        noteId,
        tx,
      );

      return tx.jobNote.update({
        where: {
          id: noteId,
        },
        data: {
          content: input.content.trim(),
        },
        select: this.noteSelect(),
      });
    });
  }

  async deleteForUser(clerkUserId: string, jobId: string, noteId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      await this.requireNoteForJob(
        membership.organizationId,
        jobId,
        noteId,
        tx,
      );

      await tx.jobNote.delete({
        where: {
          id: noteId,
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

  private async requireNoteForJob(
    organizationId: string,
    jobId: string,
    noteId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const note = await client.jobNote.findFirst({
      where: {
        id: noteId,
        organizationId,
        jobId,
      },
      select: {
        id: true,
        content: true,
      },
    });

    if (!note) {
      throw new NotFoundException('Job note not found');
    }

    return note;
  }

  private getMembership(clerkUserId: string) {
    return this.organizationMemberships.resolveForUser(clerkUserId);
  }

  private noteSelect(): Prisma.JobNoteSelect {
    return {
      id: true,
      organizationId: true,
      jobId: true,
      createdByUserId: true,

      content: true,

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
