import { Injectable, NotFoundException } from '@nestjs/common';
import {
  db,
  fromPrisma8Timestamp,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { OrganizationMembershipService } from '../auth/organization-membership.service';

import type { CreateJobTaskDto } from './dto/create-job-task.dto';
import type { UpdateJobTaskDto } from './dto/update-job-task.dto';

type OrmSource = typeof db.orm;

type JobTaskRecord = {
  id: string;
  organizationId: string;
  jobId: string;
  createdByUserId: string | null;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueDate: Parameters<typeof fromPrisma8Timestamp>[0] | null;
  completedAt: Parameters<typeof fromPrisma8Timestamp>[0] | null;
  createdAt: Parameters<typeof fromPrisma8Timestamp>[0];
  updatedAt: Parameters<typeof fromPrisma8Timestamp>[0];
};

@Injectable()
export class JobTasksService {
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

    const tasks = await db.orm.public.JobTask.where({
      organizationId: membership.organizationId,
      jobId,
    })
      .select(
        'id',
        'organizationId',
        'jobId',
        'createdByUserId',
        'title',
        'description',
        'status',
        'priority',
        'dueDate',
        'completedAt',
        'createdAt',
        'updatedAt',
      )
      .orderBy([
        (model) => model.completedAt.asc(),
        (model) => model.createdAt.desc(),
      ])
      .all();

    return Promise.all(tasks.map((task) => this.hydrateTask(db.orm, task)));
  }

  async createForUser(
    clerkUserId: string,
    jobId: string,
    input: CreateJobTaskDto,
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

      const status = input.status ?? 'TODO';

      const now = toPrisma8Timestamp();

      const task = await tx.orm.public.JobTask.create({
        organizationId: membership.organizationId,

        jobId,

        createdByUserId: membership.userId,

        title: input.title.trim(),

        description: clean(input.description),

        status,

        priority: input.priority,

        dueDate: input.dueDate
          ? toPrisma8Timestamp(new Date(input.dueDate))
          : null,

        completedAt: status === 'COMPLETED' ? now : null,

        createdAt: now,

        updatedAt: now,
      });

      await tx.orm.public.CustomerActivity.create({
        organizationId: membership.organizationId,

        customerId: job.customerId,

        actorUserId: membership.userId,

        _type: 'TASK_CREATED',

        title: 'Task created',

        description: `${task.title} was added to ${job.name}.`,

        metadata: {
          jobId,

          jobName: job.name,

          taskId: task.id,

          taskTitle: task.title,
        },
      });

      return this.hydrateTask(tx.orm, task);
    });
  }

  async updateForUser(
    clerkUserId: string,
    jobId: string,
    taskId: string,
    input: UpdateJobTaskDto,
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

      const existing = await this.requireTaskForJob(
        membership.organizationId,
        jobId,
        taskId,
        tx.orm,
      );

      const existingDueDate =
        existing.dueDate === null
          ? null
          : fromPrisma8Timestamp(existing.dueDate);

      const nextValues = {
        title: input.title !== undefined ? input.title.trim() : existing.title,

        description:
          input.description !== undefined
            ? clean(input.description)
            : existing.description,

        status: input.status !== undefined ? input.status : existing.status,

        priority:
          input.priority !== undefined ? input.priority : existing.priority,

        dueDate:
          input.dueDate !== undefined
            ? input.dueDate
              ? new Date(input.dueDate)
              : null
            : existingDueDate,
      };

      let completedAt = existing.completedAt;

      if (
        nextValues.status === 'COMPLETED' &&
        existing.status !== 'COMPLETED'
      ) {
        completedAt = toPrisma8Timestamp();
      }

      if (
        nextValues.status !== 'COMPLETED' &&
        existing.status === 'COMPLETED'
      ) {
        completedAt = null;
      }

      const changes: TaskChangeMap = {};

      addChange(changes, 'title', existing.title, nextValues.title);

      addChange(
        changes,
        'description',
        existing.description,
        nextValues.description,
      );

      addChange(changes, 'status', existing.status, nextValues.status);

      addChange(changes, 'priority', existing.priority, nextValues.priority);

      addDateChange(changes, 'dueDate', existingDueDate, nextValues.dueDate);

      await tx.orm.public.JobTask.where({
        id: taskId,
      }).update({
        title: nextValues.title,

        description: nextValues.description,

        status: nextValues.status,

        priority: nextValues.priority,

        dueDate:
          nextValues.dueDate === null
            ? null
            : toPrisma8Timestamp(nextValues.dueDate),

        completedAt,

        updatedAt: toPrisma8Timestamp(),
      });

      const task = await this.requireTaskForJob(
        membership.organizationId,
        jobId,
        taskId,
        tx.orm,
      );

      if (Object.keys(changes).length > 0) {
        await tx.orm.public.CustomerActivity.create({
          organizationId: membership.organizationId,

          customerId: job.customerId,

          actorUserId: membership.userId,

          _type: 'TASK_UPDATED',

          title: 'Task updated',

          description: `${task.title} was updated on ${job.name}.`,

          metadata: {
            jobId,

            jobName: job.name,

            taskId: task.id,

            taskTitle: task.title,

            changes,
          },
        });
      }

      return this.hydrateTask(tx.orm, task);
    });
  }

  async completeForUser(
    clerkUserId: string,
    jobId: string,
    taskId: string,
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

      const existing = await this.requireTaskForJob(
        membership.organizationId,
        jobId,
        taskId,
        tx.orm,
      );

      if (existing.status === 'COMPLETED') {
        return this.hydrateTask(tx.orm, existing);
      }

      const now = toPrisma8Timestamp();

      await tx.orm.public.JobTask.where({
        id: taskId,
      }).update({
        status: 'COMPLETED',

        completedAt: now,

        updatedAt: now,
      });

      const task = await this.requireTaskForJob(
        membership.organizationId,
        jobId,
        taskId,
        tx.orm,
      );

      await tx.orm.public.CustomerActivity.create({
        organizationId: membership.organizationId,

        customerId: job.customerId,

        actorUserId: membership.userId,

        _type: 'TASK_COMPLETED',

        title: 'Task completed',

        description: `${task.title} was completed on ${job.name}.`,

        metadata: {
          jobId,

          jobName: job.name,

          taskId: task.id,

          taskTitle: task.title,
        },
      });

      return this.hydrateTask(tx.orm, task);
    });
  }

  async reopenForUser(
    clerkUserId: string,
    jobId: string,
    taskId: string,
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

      const existing = await this.requireTaskForJob(
        membership.organizationId,
        jobId,
        taskId,
        tx.orm,
      );

      if (existing.status !== 'COMPLETED') {
        return this.hydrateTask(tx.orm, existing);
      }

      await tx.orm.public.JobTask.where({
        id: taskId,
      }).update({
        status: 'TODO',

        completedAt: null,

        updatedAt: toPrisma8Timestamp(),
      });

      const task = await this.requireTaskForJob(
        membership.organizationId,
        jobId,
        taskId,
        tx.orm,
      );

      await tx.orm.public.CustomerActivity.create({
        organizationId: membership.organizationId,

        customerId: job.customerId,

        actorUserId: membership.userId,

        _type: 'TASK_REOPENED',

        title: 'Task reopened',

        description: `${task.title} was reopened on ${job.name}.`,

        metadata: {
          jobId,

          jobName: job.name,

          taskId: task.id,

          taskTitle: task.title,
        },
      });

      return this.hydrateTask(tx.orm, task);
    });
  }

  async deleteForUser(
    clerkUserId: string,
    jobId: string,
    taskId: string,
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

      const existing = await this.requireTaskForJob(
        membership.organizationId,
        jobId,
        taskId,
        tx.orm,
      );

      await tx.orm.public.JobTask.where({
        id: taskId,
      }).delete();

      await tx.orm.public.CustomerActivity.create({
        organizationId: membership.organizationId,

        customerId: job.customerId,

        actorUserId: membership.userId,

        _type: 'TASK_DELETED',

        title: 'Task deleted',

        description: `${existing.title} was removed from ${job.name}.`,

        metadata: {
          jobId,

          jobName: job.name,

          taskId: existing.id,

          taskTitle: existing.title,
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

  private async requireTaskForJob(
    organizationId: string,
    jobId: string,
    taskId: string,
    orm: OrmSource = db.orm,
  ) {
    const task = await orm.public.JobTask.where({
      id: taskId,
      jobId,
      organizationId,
    })
      .select(
        'id',
        'organizationId',
        'jobId',
        'createdByUserId',
        'title',
        'description',
        'status',
        'priority',
        'dueDate',
        'completedAt',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }

  private async hydrateTask(orm: OrmSource, task: JobTaskRecord) {
    const createdBy =
      task.createdByUserId === null
        ? null
        : await orm.public.User.where({
            id: task.createdByUserId,
          })
            .select('id', 'firstName', 'lastName', 'email')
            .first();

    return {
      id: task.id,

      organizationId: task.organizationId,

      jobId: task.jobId,

      createdByUserId: task.createdByUserId,

      title: task.title,

      description: task.description,

      status: task.status,

      priority: task.priority,

      dueDate:
        task.dueDate === null ? null : fromPrisma8Timestamp(task.dueDate),

      completedAt:
        task.completedAt === null
          ? null
          : fromPrisma8Timestamp(task.completedAt),

      createdAt: fromPrisma8Timestamp(task.createdAt),

      updatedAt: fromPrisma8Timestamp(task.updatedAt),

      createdBy,
    };
  }
}

type TaskChangeMap = Record<
  string,
  {
    oldValue: string | null;
    newValue: string | null;
  }
>;

function addChange(
  changes: TaskChangeMap,
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
  changes: TaskChangeMap,
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

function clean(value: string | null | undefined): string | null {
  const result = value?.trim();

  return result || null;
}
