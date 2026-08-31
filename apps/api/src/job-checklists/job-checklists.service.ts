import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerActivityType, Prisma, prisma } from '@contractflow/db';

import { OrganizationMembershipService } from '../auth/organization-membership.service';

import { ActivityService } from '../activity/activity.service';
import type { ApplyChecklistTemplateDto } from './dto/apply-checklist-template.dto';
import type { UpdateJobChecklistDto } from './dto/update-job-checklist.dto';

@Injectable()
export class JobChecklistsService {
  constructor(
    private readonly activityService: ActivityService,
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

    return prisma.jobChecklist.findMany({
      where: {
        organizationId: membership.organizationId,
        jobId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: this.checklistSelect(),
    });
  }

  async applyTemplateForUser(
    clerkUserId: string,
    jobId: string,
    input: ApplyChecklistTemplateDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const existingChecklist = await tx.jobChecklist.findFirst({
        where: {
          organizationId: membership.organizationId,
          jobId,
          sourceTemplateId: input.templateId,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (existingChecklist) {
        throw new BadRequestException(
          `"${existingChecklist.name}" has already been applied to this job.`,
        );
      }

      const template = await tx.checklistTemplate.findFirst({
        where: {
          id: input.templateId,
          organizationId: membership.organizationId,
          active: true,
        },
        select: {
          id: true,
          name: true,
          description: true,
          items: {
            orderBy: [
              {
                position: 'asc',
              },
              {
                createdAt: 'asc',
              },
            ],
            select: {
              title: true,
              description: true,
              position: true,
              required: true,
            },
          },
        },
      });

      if (!template) {
        throw new NotFoundException('Active checklist template not found');
      }

      const checklist = await tx.jobChecklist.create({
        data: {
          organizationId: membership.organizationId,
          jobId,
          sourceTemplateId: template.id,
          createdByUserId: membership.userId,

          name: template.name,
          description: template.description,

          items: {
            create: template.items.map((item) => ({
              organizationId: membership.organizationId,
              title: item.title,
              description: item.description,
              position: item.position,
              required: item.required,
            })),
          },
        },
        select: this.checklistSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.JOB_CHECKLIST_CREATED,
          title: 'Job checklist added',
          description: `${checklist.name} was added to ${job.name}.`,
          metadata: {
            jobId,
            jobName: job.name,
            checklistId: checklist.id,
            checklistName: checklist.name,
            sourceTemplateId: template.id,
            itemCount: checklist.items.length,
          },
        },
        tx,
      );

      return checklist;
    });
  }

  async updateForUser(
    clerkUserId: string,
    jobId: string,
    checklistId: string,
    input: UpdateJobChecklistDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const existing = await this.requireChecklistForJob(
        membership.organizationId,
        jobId,
        checklistId,
        tx,
      );

      const nextName =
        input.name !== undefined ? input.name.trim() : existing.name;

      const nextDescription =
        input.description !== undefined
          ? clean(input.description)
          : existing.description;

      const changes: Record<
        string,
        {
          oldValue: string | null;
          newValue: string | null;
        }
      > = {};

      addChange(changes, 'name', existing.name, nextName);
      addChange(changes, 'description', existing.description, nextDescription);

      const checklist = await tx.jobChecklist.update({
        where: {
          id: existing.id,
        },
        data: {
          name: nextName,
          description: nextDescription,
        },
        select: this.checklistSelect(),
      });

      if (Object.keys(changes).length > 0) {
        await this.activityService.recordCustomerActivity(
          {
            organizationId: membership.organizationId,
            customerId: job.customerId,
            actorUserId: membership.userId,
            type: CustomerActivityType.JOB_CHECKLIST_UPDATED,
            title: 'Job checklist updated',
            description: `${checklist.name} was updated on ${job.name}.`,
            metadata: {
              jobId,
              jobName: job.name,
              checklistId: checklist.id,
              checklistName: checklist.name,
              changes,
            },
          },
          tx,
        );
      }

      return checklist;
    });
  }

  async completeItemForUser(
    clerkUserId: string,
    jobId: string,
    checklistId: string,
    itemId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const checklist = await this.requireChecklistForJob(
        membership.organizationId,
        jobId,
        checklistId,
        tx,
      );

      const existing = await this.requireItemForChecklist(
        membership.organizationId,
        checklistId,
        itemId,
        tx,
      );

      if (existing.completedAt) {
        return tx.jobChecklistItem.findUniqueOrThrow({
          where: {
            id: existing.id,
          },
          select: this.itemSelect(),
        });
      }

      const item = await tx.jobChecklistItem.update({
        where: {
          id: existing.id,
        },
        data: {
          completedAt: new Date(),
          completedByUserId: membership.userId,
        },
        select: this.itemSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.JOB_CHECKLIST_ITEM_COMPLETED,
          title: 'Checklist item completed',
          description: `${item.title} was completed on ${job.name}.`,
          metadata: {
            jobId,
            jobName: job.name,
            checklistId: checklist.id,
            checklistName: checklist.name,
            itemId: item.id,
            itemTitle: item.title,
          },
        },
        tx,
      );

      return item;
    });
  }

  async reopenItemForUser(
    clerkUserId: string,
    jobId: string,
    checklistId: string,
    itemId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const checklist = await this.requireChecklistForJob(
        membership.organizationId,
        jobId,
        checklistId,
        tx,
      );

      const existing = await this.requireItemForChecklist(
        membership.organizationId,
        checklistId,
        itemId,
        tx,
      );

      if (!existing.completedAt) {
        return tx.jobChecklistItem.findUniqueOrThrow({
          where: {
            id: existing.id,
          },
          select: this.itemSelect(),
        });
      }

      const item = await tx.jobChecklistItem.update({
        where: {
          id: existing.id,
        },
        data: {
          completedAt: null,
          completedByUserId: null,
        },
        select: this.itemSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.JOB_CHECKLIST_ITEM_REOPENED,
          title: 'Checklist item reopened',
          description: `${item.title} was reopened on ${job.name}.`,
          metadata: {
            jobId,
            jobName: job.name,
            checklistId: checklist.id,
            checklistName: checklist.name,
            itemId: item.id,
            itemTitle: item.title,
          },
        },
        tx,
      );

      return item;
    });
  }

  async deleteForUser(
    clerkUserId: string,
    jobId: string,
    checklistId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const existing = await this.requireChecklistForJob(
        membership.organizationId,
        jobId,
        checklistId,
        tx,
      );

      await tx.jobChecklist.delete({
        where: {
          id: existing.id,
        },
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.JOB_CHECKLIST_DELETED,
          title: 'Job checklist deleted',
          description: `${existing.name} was removed from ${job.name}.`,
          metadata: {
            jobId,
            jobName: job.name,
            checklistId: existing.id,
            checklistName: existing.name,
          },
        },
        tx,
      );

      return {
        success: true,
      };
    });
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
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
        name: true,
        customerId: true,
        archivedAt: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  private async requireChecklistForJob(
    organizationId: string,
    jobId: string,
    checklistId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const checklist = await client.jobChecklist.findFirst({
      where: {
        id: checklistId,
        organizationId,
        jobId,
      },
      select: this.checklistSelect(),
    });

    if (!checklist) {
      throw new NotFoundException('Job checklist not found');
    }

    return checklist;
  }

  private async requireItemForChecklist(
    organizationId: string,
    checklistId: string,
    itemId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const item = await client.jobChecklistItem.findFirst({
      where: {
        id: itemId,
        organizationId,
        checklistId,
      },
      select: this.itemSelect(),
    });

    if (!item) {
      throw new NotFoundException('Checklist item not found');
    }

    return item;
  }

  private checklistSelect(): Prisma.JobChecklistSelect {
    return {
      id: true,
      organizationId: true,
      jobId: true,
      sourceTemplateId: true,
      createdByUserId: true,
      name: true,
      description: true,
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

      items: {
        orderBy: [
          {
            position: 'asc',
          },
          {
            createdAt: 'asc',
          },
        ],
        select: this.itemSelect(),
      },
    };
  }

  private itemSelect(): Prisma.JobChecklistItemSelect {
    return {
      id: true,
      organizationId: true,
      checklistId: true,
      title: true,
      description: true,
      position: true,
      required: true,
      completedAt: true,
      completedByUserId: true,
      createdAt: true,
      updatedAt: true,

      completedBy: {
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

function clean(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function addChange(
  changes: Record<
    string,
    {
      oldValue: string | null;
      newValue: string | null;
    }
  >,
  key: string,
  oldValue: string | null,
  newValue: string | null,
) {
  if (oldValue === newValue) {
    return;
  }

  changes[key] = {
    oldValue,
    newValue,
  };
}
