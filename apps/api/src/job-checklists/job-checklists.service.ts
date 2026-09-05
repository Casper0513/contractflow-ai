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

import type { ApplyChecklistTemplateDto } from './dto/apply-checklist-template.dto';
import type { UpdateJobChecklistDto } from './dto/update-job-checklist.dto';

type OrmSource = typeof db.orm;

type ActivityType =
  | 'JOB_CHECKLIST_CREATED'
  | 'JOB_CHECKLIST_UPDATED'
  | 'JOB_CHECKLIST_DELETED'
  | 'JOB_CHECKLIST_ITEM_COMPLETED'
  | 'JOB_CHECKLIST_ITEM_REOPENED';

type JsonInput =
  | null
  | boolean
  | number
  | string
  | JsonInput[]
  | {
      [key: string]: JsonInput;
    };

type RecordActivityInput = {
  organizationId: string;
  customerId: string;
  actorUserId: string | null;
  type: ActivityType;
  title: string;
  description: string;
  metadata: JsonInput;
};

@Injectable()
export class JobChecklistsService {
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

    const checklists = await db.orm.public.JobChecklist.where({
      organizationId: membership.organizationId,
      jobId,
    })
      .select(
        'id',
        'organizationId',
        'jobId',
        'sourceTemplateId',
        'createdByUserId',
        'name',
        'description',
        'createdAt',
        'updatedAt',
      )
      .orderBy((model) => model.createdAt.desc())
      .all();

    const result = [];

    for (const checklist of checklists) {
      result.push(
        await this.readChecklistShape(
          membership.organizationId,
          jobId,
          checklist.id,
        ),
      );
    }

    return result;
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

    return db.transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx.orm,
      );

      const existingChecklist = await tx.orm.public.JobChecklist.where({
        organizationId: membership.organizationId,
        jobId,
        sourceTemplateId: input.templateId,
      })
        .select('id', 'name')
        .first();

      if (existingChecklist) {
        throw new BadRequestException(
          `"${existingChecklist.name}" has already been applied to this job.`,
        );
      }

      const template = await tx.orm.public.ChecklistTemplate.where({
        id: input.templateId,
        organizationId: membership.organizationId,
        active: true,
      })
        .select('id', 'name', 'description')
        .first();

      if (!template) {
        throw new NotFoundException('Active checklist template not found');
      }

      const templateItems = await tx.orm.public.ChecklistTemplateItem.where({
        templateId: template.id,
      })
        .select(
          'id',
          'title',
          'description',
          'position',
          'required',
          'createdAt',
        )
        .orderBy([
          (model) => model.position.asc(),
          (model) => model.createdAt.asc(),
        ])
        .all();

      const checklist = await tx.orm.public.JobChecklist.create({
        organizationId: membership.organizationId,
        jobId,
        sourceTemplateId: template.id,
        createdByUserId: membership.userId,
        name: template.name,
        description: template.description,
        updatedAt: toPrisma8Timestamp(),
      });

      for (const templateItem of templateItems) {
        await tx.orm.public.JobChecklistItem.create({
          organizationId: membership.organizationId,
          checklistId: checklist.id,
          title: templateItem.title,
          description: templateItem.description,
          position: templateItem.position,
          required: templateItem.required,
          completedAt: null,
          completedByUserId: null,
          updatedAt: toPrisma8Timestamp(),
        });
      }

      await this.recordActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: 'JOB_CHECKLIST_CREATED',
          title: 'Job checklist added',
          description: `${checklist.name} was added to ${job.name}.`,
          metadata: {
            jobId,
            jobName: job.name,
            checklistId: checklist.id,
            checklistName: checklist.name,
            sourceTemplateId: template.id,
            itemCount: templateItems.length,
          },
        },
        tx.orm,
      );

      return this.readChecklistShape(
        membership.organizationId,
        jobId,
        checklist.id,
        tx.orm,
      );
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

    return db.transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx.orm,
      );

      const existing = await this.requireChecklistForJob(
        membership.organizationId,
        jobId,
        checklistId,
        tx.orm,
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

      await tx.orm.public.JobChecklist.where({
        id: existing.id,
      }).update({
        name: nextName,
        description: nextDescription,
        updatedAt: toPrisma8Timestamp(),
      });

      const checklist = await this.readChecklistShape(
        membership.organizationId,
        jobId,
        checklistId,
        tx.orm,
      );

      if (Object.keys(changes).length > 0) {
        await this.recordActivity(
          {
            organizationId: membership.organizationId,
            customerId: job.customerId,
            actorUserId: membership.userId,
            type: 'JOB_CHECKLIST_UPDATED',
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
          tx.orm,
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

    return db.transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx.orm,
      );

      const checklist = await this.requireChecklistForJob(
        membership.organizationId,
        jobId,
        checklistId,
        tx.orm,
      );

      const existing = await this.requireItemForChecklist(
        membership.organizationId,
        checklistId,
        itemId,
        tx.orm,
      );

      if (existing.completedAt) {
        return this.readItemShape(
          membership.organizationId,
          checklistId,
          itemId,
          tx.orm,
        );
      }

      await tx.orm.public.JobChecklistItem.where({
        id: existing.id,
      }).update({
        completedAt: toPrisma8Timestamp(),
        completedByUserId: membership.userId,
        updatedAt: toPrisma8Timestamp(),
      });

      const item = await this.readItemShape(
        membership.organizationId,
        checklistId,
        itemId,
        tx.orm,
      );

      await this.recordActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: 'JOB_CHECKLIST_ITEM_COMPLETED',
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
        tx.orm,
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

    return db.transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx.orm,
      );

      const checklist = await this.requireChecklistForJob(
        membership.organizationId,
        jobId,
        checklistId,
        tx.orm,
      );

      const existing = await this.requireItemForChecklist(
        membership.organizationId,
        checklistId,
        itemId,
        tx.orm,
      );

      if (!existing.completedAt) {
        return this.readItemShape(
          membership.organizationId,
          checklistId,
          itemId,
          tx.orm,
        );
      }

      await tx.orm.public.JobChecklistItem.where({
        id: existing.id,
      }).update({
        completedAt: null,
        completedByUserId: null,
        updatedAt: toPrisma8Timestamp(),
      });

      const item = await this.readItemShape(
        membership.organizationId,
        checklistId,
        itemId,
        tx.orm,
      );

      await this.recordActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: 'JOB_CHECKLIST_ITEM_REOPENED',
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
        tx.orm,
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

    return db.transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx.orm,
      );

      const existing = await this.requireChecklistForJob(
        membership.organizationId,
        jobId,
        checklistId,
        tx.orm,
      );

      await tx.orm.public.JobChecklist.where({
        id: existing.id,
      }).delete();

      await this.recordActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: 'JOB_CHECKLIST_DELETED',
          title: 'Job checklist deleted',
          description: `${existing.name} was removed from ${job.name}.`,
          metadata: {
            jobId,
            jobName: job.name,
            checklistId: existing.id,
            checklistName: existing.name,
          },
        },
        tx.orm,
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
    orm: OrmSource = db.orm,
  ) {
    const job = await orm.public.Job.where({
      id: jobId,
      organizationId,
    })
      .select('id', 'name', 'customerId', 'archivedAt')
      .first();

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  private async requireChecklistForJob(
    organizationId: string,
    jobId: string,
    checklistId: string,
    orm: OrmSource = db.orm,
  ) {
    const checklist = await orm.public.JobChecklist.where({
      id: checklistId,
      organizationId,
      jobId,
    })
      .select(
        'id',
        'organizationId',
        'jobId',
        'sourceTemplateId',
        'createdByUserId',
        'name',
        'description',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!checklist) {
      throw new NotFoundException('Job checklist not found');
    }

    return checklist;
  }

  private async requireItemForChecklist(
    organizationId: string,
    checklistId: string,
    itemId: string,
    orm: OrmSource = db.orm,
  ) {
    const item = await orm.public.JobChecklistItem.where({
      id: itemId,
      organizationId,
      checklistId,
    })
      .select(
        'id',
        'organizationId',
        'checklistId',
        'title',
        'description',
        'position',
        'required',
        'completedAt',
        'completedByUserId',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!item) {
      throw new NotFoundException('Checklist item not found');
    }

    return item;
  }

  private async readChecklistShape(
    organizationId: string,
    jobId: string,
    checklistId: string,
    orm: OrmSource = db.orm,
  ) {
    const checklist = await this.requireChecklistForJob(
      organizationId,
      jobId,
      checklistId,
      orm,
    );

    const rawItems = await orm.public.JobChecklistItem.where({
      organizationId,
      checklistId,
    })
      .select(
        'id',
        'organizationId',
        'checklistId',
        'title',
        'description',
        'position',
        'required',
        'completedAt',
        'completedByUserId',
        'createdAt',
        'updatedAt',
      )
      .orderBy([
        (model) => model.position.asc(),
        (model) => model.createdAt.asc(),
      ])
      .all();

    const createdBy = checklist.createdByUserId
      ? await this.readUser(checklist.createdByUserId, orm)
      : null;

    const items = [];

    for (const item of rawItems) {
      const completedBy = item.completedByUserId
        ? await this.readUser(item.completedByUserId, orm)
        : null;

      items.push({
        id: item.id,
        organizationId: item.organizationId,
        checklistId: item.checklistId,
        title: item.title,
        description: item.description,
        position: item.position,
        required: item.required,
        completedAt: item.completedAt
          ? fromPrisma8Timestamp(item.completedAt)
          : null,
        completedByUserId: item.completedByUserId,
        createdAt: fromPrisma8Timestamp(item.createdAt),
        updatedAt: fromPrisma8Timestamp(item.updatedAt),
        completedBy,
      });
    }

    return {
      id: checklist.id,
      organizationId: checklist.organizationId,
      jobId: checklist.jobId,
      sourceTemplateId: checklist.sourceTemplateId,
      createdByUserId: checklist.createdByUserId,
      name: checklist.name,
      description: checklist.description,
      createdAt: fromPrisma8Timestamp(checklist.createdAt),
      updatedAt: fromPrisma8Timestamp(checklist.updatedAt),
      createdBy,
      items,
    };
  }

  private async readItemShape(
    organizationId: string,
    checklistId: string,
    itemId: string,
    orm: OrmSource = db.orm,
  ) {
    const item = await this.requireItemForChecklist(
      organizationId,
      checklistId,
      itemId,
      orm,
    );

    const completedBy = item.completedByUserId
      ? await this.readUser(item.completedByUserId, orm)
      : null;

    return {
      id: item.id,
      organizationId: item.organizationId,
      checklistId: item.checklistId,
      title: item.title,
      description: item.description,
      position: item.position,
      required: item.required,
      completedAt: item.completedAt
        ? fromPrisma8Timestamp(item.completedAt)
        : null,
      completedByUserId: item.completedByUserId,
      createdAt: fromPrisma8Timestamp(item.createdAt),
      updatedAt: fromPrisma8Timestamp(item.updatedAt),
      completedBy,
    };
  }

  private async readUser(userId: string, orm: OrmSource = db.orm) {
    return orm.public.User.where({
      id: userId,
    })
      .select('id', 'firstName', 'lastName', 'email')
      .first();
  }

  private async recordActivity(input: RecordActivityInput, orm: OrmSource) {
    return orm.public.CustomerActivity.create({
      organizationId: input.organizationId,
      customerId: input.customerId,
      actorUserId: input.actorUserId,
      _type: input.type,
      title: input.title,
      description: input.description,
      metadata: input.metadata,
    });
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
