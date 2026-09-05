import { Injectable, NotFoundException } from '@nestjs/common';
import {
  db,
  fromPrisma8Timestamp,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { OrganizationMembershipService } from '../auth/organization-membership.service';

import type { CreateJobNoteDto } from './dto/create-job-note.dto';
import type { UpdateJobNoteDto } from './dto/update-job-note.dto';

type OrmSource = typeof db.orm;

@Injectable()
export class JobNotesService {
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

    const notes = await db.orm.public.JobNote.where({
      organizationId: membership.organizationId,
      jobId,
    })
      .select(
        'id',
        'organizationId',
        'jobId',
        'createdByUserId',
        'content',
        'createdAt',
        'updatedAt',
      )
      .orderBy((model) => model.createdAt.desc())
      .all();

    return Promise.all(
      notes.map(async (note) => this.hydrateNote(db.orm, note)),
    );
  }

  async createForUser(
    clerkUserId: string,
    jobId: string,
    input: CreateJobNoteDto,
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

      const note = await tx.orm.public.JobNote.create({
        organizationId: membership.organizationId,
        jobId,
        createdByUserId: membership.userId,
        content: input.content.trim(),
        createdAt: now,
        updatedAt: now,
      });

      await tx.orm.public.CustomerActivity.create({
        organizationId: membership.organizationId,
        customerId: job.customerId,
        actorUserId: membership.userId,
        _type: 'NOTE_ADDED',
        title: 'Job note added',
        description: `A note was added to ${job.name}.`,
        metadata: {
          jobId,
          jobName: job.name,
          noteId: note.id,
        },
      });

      const hydrated = await this.hydrateNote(tx.orm, note);

      return hydrated;
    });
  }

  async updateForUser(
    clerkUserId: string,
    jobId: string,
    noteId: string,
    input: UpdateJobNoteDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx.orm,
      );

      await this.requireNoteForJob(
        membership.organizationId,
        jobId,
        noteId,
        tx.orm,
      );

      const now = toPrisma8Timestamp();

      await tx.orm.public.JobNote.where({
        id: noteId,
      }).update({
        content: input.content.trim(),
        updatedAt: now,
      });

      const updated = await tx.orm.public.JobNote.where({
        id: noteId,
      })
        .select(
          'id',
          'organizationId',
          'jobId',
          'createdByUserId',
          'content',
          'createdAt',
          'updatedAt',
        )
        .first();

      if (!updated) {
        throw new NotFoundException('Job note not found');
      }

      return this.hydrateNote(tx.orm, updated);
    });
  }

  async deleteForUser(
    clerkUserId: string,
    jobId: string,
    noteId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx.orm,
      );

      await this.requireNoteForJob(
        membership.organizationId,
        jobId,
        noteId,
        tx.orm,
      );

      await tx.orm.public.JobNote.where({
        id: noteId,
      }).delete();

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

  private async requireNoteForJob(
    organizationId: string,
    jobId: string,
    noteId: string,
    orm: OrmSource = db.orm,
  ) {
    const note = await orm.public.JobNote.where({
      id: noteId,
      organizationId,
      jobId,
    })
      .select('id', 'content')
      .first();

    if (!note) {
      throw new NotFoundException('Job note not found');
    }

    return note;
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }

  private async hydrateNote(
    orm: OrmSource,
    note: {
      id: string;
      organizationId: string;
      jobId: string;
      createdByUserId: string | null;
      content: string;
      createdAt: Parameters<typeof fromPrisma8Timestamp>[0];
      updatedAt: Parameters<typeof fromPrisma8Timestamp>[0];
    },
  ) {
    const createdBy =
      note.createdByUserId === null
        ? null
        : await orm.public.User.where({
            id: note.createdByUserId,
          })
            .select('id', 'firstName', 'lastName', 'email')
            .first();

    return {
      id: note.id,

      organizationId: note.organizationId,

      jobId: note.jobId,

      createdByUserId: note.createdByUserId,

      content: note.content,

      createdAt: fromPrisma8Timestamp(note.createdAt),

      updatedAt: fromPrisma8Timestamp(note.updatedAt),

      createdBy,
    };
  }
}
