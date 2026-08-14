import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CustomerActivityType,
  JobTaskStatus,
  Prisma,
  prisma,
} from '@contractflow/db';

import { ActivityService } from '../activity/activity.service';
import type { CreateJobTaskDto } from './dto/create-job-task.dto';
import type { UpdateJobTaskDto } from './dto/update-job-task.dto';

@Injectable()
export class JobTasksService {
  constructor(private readonly activityService: ActivityService) {}

  async listForJobForUser(clerkUserId: string, jobId: string) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireJobForOrganization(membership.organizationId, jobId);

    return prisma.jobTask.findMany({
      where: {
        organizationId: membership.organizationId,
        jobId,
      },
      orderBy: [
        {
          completedAt: 'asc',
        },
        {
          createdAt: 'desc',
        },
      ],
      select: this.taskSelect(),
    });
  }

  async createForUser(
    clerkUserId: string,
    jobId: string,
    input: CreateJobTaskDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const status = input.status ?? JobTaskStatus.TODO;

      const task = await tx.jobTask.create({
        data: {
          organizationId: membership.organizationId,
          jobId,
          createdByUserId: membership.userId,

          title: input.title.trim(),
          description: clean(input.description),

          status,
          priority: input.priority,

          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,

          completedAt:
            status === JobTaskStatus.COMPLETED ? new Date() : undefined,
        },
        select: this.taskSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.TASK_CREATED,
          title: 'Task created',
          description: `${task.title} was added to ${job.name}.`,
          metadata: {
            jobId,
            jobName: job.name,
            taskId: task.id,
            taskTitle: task.title,
          },
        },
        tx,
      );

      return task;
    });
  }

  async updateForUser(
    clerkUserId: string,
    jobId: string,
    taskId: string,
    input: UpdateJobTaskDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const existing = await this.requireTaskForJob(
        membership.organizationId,
        jobId,
        taskId,
        tx,
      );

      const nextValues = {
        title: input.title !== undefined ? input.title.trim() : existing.title,

        description:
          input.description !== undefined
            ? (clean(input.description) ?? null)
            : existing.description,

        status: input.status !== undefined ? input.status : existing.status,

        priority:
          input.priority !== undefined ? input.priority : existing.priority,

        dueDate:
          input.dueDate !== undefined
            ? input.dueDate
              ? new Date(input.dueDate)
              : null
            : existing.dueDate,
      };

      let completedAt = existing.completedAt;

      if (
        nextValues.status === JobTaskStatus.COMPLETED &&
        existing.status !== JobTaskStatus.COMPLETED
      ) {
        completedAt = new Date();
      }

      if (
        nextValues.status !== JobTaskStatus.COMPLETED &&
        existing.status === JobTaskStatus.COMPLETED
      ) {
        completedAt = null;
      }

      const changes: Record<
        string,
        {
          oldValue: string | null;
          newValue: string | null;
        }
      > = {};

      addChange(changes, 'title', existing.title, nextValues.title);

      addChange(
        changes,
        'description',
        existing.description,
        nextValues.description,
      );

      addChange(changes, 'status', existing.status, nextValues.status);

      addChange(changes, 'priority', existing.priority, nextValues.priority);

      addDateChange(changes, 'dueDate', existing.dueDate, nextValues.dueDate);

      const task = await tx.jobTask.update({
        where: {
          id: taskId,
        },
        data: {
          title: nextValues.title,
          description: nextValues.description,
          status: nextValues.status,
          priority: nextValues.priority,
          dueDate: nextValues.dueDate,
          completedAt,
        },
        select: this.taskSelect(),
      });

      if (Object.keys(changes).length > 0) {
        await this.activityService.recordCustomerActivity(
          {
            organizationId: membership.organizationId,
            customerId: job.customerId,
            actorUserId: membership.userId,
            type: CustomerActivityType.TASK_UPDATED,
            title: 'Task updated',
            description: `${task.title} was updated on ${job.name}.`,
            metadata: {
              jobId,
              jobName: job.name,
              taskId: task.id,
              taskTitle: task.title,
              changes,
            },
          },
          tx,
        );
      }

      return task;
    });
  }

  async completeForUser(clerkUserId: string, jobId: string, taskId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const existing = await this.requireTaskForJob(
        membership.organizationId,
        jobId,
        taskId,
        tx,
      );

      if (existing.status === JobTaskStatus.COMPLETED) {
        return tx.jobTask.findUniqueOrThrow({
          where: {
            id: taskId,
          },
          select: this.taskSelect(),
        });
      }

      const task = await tx.jobTask.update({
        where: {
          id: taskId,
        },
        data: {
          status: JobTaskStatus.COMPLETED,
          completedAt: new Date(),
        },
        select: this.taskSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.TASK_COMPLETED,
          title: 'Task completed',
          description: `${task.title} was completed on ${job.name}.`,
          metadata: {
            jobId,
            jobName: job.name,
            taskId: task.id,
            taskTitle: task.title,
          },
        },
        tx,
      );

      return task;
    });
  }

  async reopenForUser(clerkUserId: string, jobId: string, taskId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const existing = await this.requireTaskForJob(
        membership.organizationId,
        jobId,
        taskId,
        tx,
      );

      if (existing.status !== JobTaskStatus.COMPLETED) {
        return tx.jobTask.findUniqueOrThrow({
          where: {
            id: taskId,
          },
          select: this.taskSelect(),
        });
      }

      const task = await tx.jobTask.update({
        where: {
          id: taskId,
        },
        data: {
          status: JobTaskStatus.TODO,
          completedAt: null,
        },
        select: this.taskSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.TASK_REOPENED,
          title: 'Task reopened',
          description: `${task.title} was reopened on ${job.name}.`,
          metadata: {
            jobId,
            jobName: job.name,
            taskId: task.id,
            taskTitle: task.title,
          },
        },
        tx,
      );

      return task;
    });
  }

  async deleteForUser(clerkUserId: string, jobId: string, taskId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const existing = await this.requireTaskForJob(
        membership.organizationId,
        jobId,
        taskId,
        tx,
      );

      await tx.jobTask.delete({
        where: {
          id: taskId,
        },
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.TASK_DELETED,
          title: 'Task deleted',
          description: `${existing.title} was removed from ${job.name}.`,
          metadata: {
            jobId,
            jobName: job.name,
            taskId: existing.id,
            taskTitle: existing.title,
          },
        },
        tx,
      );

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

  private async requireTaskForJob(
    organizationId: string,
    jobId: string,
    taskId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const task = await client.jobTask.findFirst({
      where: {
        id: taskId,
        jobId,
        organizationId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
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

  private taskSelect(): Prisma.JobTaskSelect {
    return {
      id: true,
      organizationId: true,
      jobId: true,
      createdByUserId: true,

      title: true,
      description: true,

      status: true,
      priority: true,

      dueDate: true,
      completedAt: true,

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

function clean(value: string | undefined): string | undefined {
  const result = value?.trim();

  return result || undefined;
}
