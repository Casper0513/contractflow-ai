import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type DatabaseTransaction,
  db,
  fromPrisma8Timestamp,
  setPrisma8Serializable,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { OrganizationMembershipService } from '../auth/organization-membership.service';

import type {
  CreateChecklistTemplateDto,
  CreateChecklistTemplateItemDto,
} from './dto/create-checklist-template.dto';
import type {
  UpdateChecklistTemplateDto,
  UpdateChecklistTemplateItemDto,
} from './dto/update-checklist-template.dto';

@Injectable()
export class ChecklistTemplatesService {
  constructor(
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async listForUser(clerkUserId: string, activeOrganizationId?: string) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const templates = await db.orm.public.ChecklistTemplate.where({
      organizationId: membership.organizationId,
    })
      .select(
        'id',
        'organizationId',
        'name',
        'description',
        'active',
        'createdAt',
        'updatedAt',
      )
      .all();

    const hydrated = [];

    for (const template of templates) {
      hydrated.push(await this.hydrateTemplatePrisma8(template));
    }

    /*
     * Preserve Prisma 7 ordering:
     *   active DESC
     *   name ASC
     */
    hydrated.sort((a, b) => {
      if (a.active !== b.active) {
        return a.active ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    });

    return hydrated;
  }

  async getForUser(
    clerkUserId: string,
    templateId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return this.requireTemplateForOrganization(
      membership.organizationId,
      templateId,
    );
  }

  async createForUser(
    clerkUserId: string,
    input: CreateChecklistTemplateDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const templateId = await db.transaction(async (tx) => {
      await setPrisma8Serializable(tx);

      const now = toPrisma8Timestamp();

      const template = await tx.orm.public.ChecklistTemplate.create({
        organizationId: membership.organizationId,

        name: this.requiredString(input.name),

        description: this.optionalString(input.description),

        active: input.active ?? true,

        createdAt: now,

        updatedAt: now,
      });

      const items = this.normalizeItems(input.items ?? []);

      for (const item of items) {
        await tx.orm.public.ChecklistTemplateItem.create({
          templateId: template.id,

          title: item.title,

          description: item.description,

          position: item.position,

          required: item.required,

          createdAt: now,

          updatedAt: now,
        });
      }

      return template.id;
    });

    return this.requireTemplateForOrganization(
      membership.organizationId,
      templateId,
    );
  }

  async updateForUser(
    clerkUserId: string,
    templateId: string,
    input: UpdateChecklistTemplateDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    await db.transaction(async (tx) => {
      await setPrisma8Serializable(tx);

      const existing = await this.requireTemplateForOrganization(
        membership.organizationId,
        templateId,
        tx,
      );

      if (input.items !== undefined) {
        const existingItems = await tx.orm.public.ChecklistTemplateItem.where({
          templateId: existing.id,
        })
          .select('id')
          .all();

        for (const item of existingItems) {
          await tx.orm.public.ChecklistTemplateItem.where({
            id: item.id,
          }).delete();
        }
      }

      await tx.orm.public.ChecklistTemplate.where({
        id: existing.id,
      }).update({
        name:
          input.name !== undefined
            ? this.requiredString(input.name)
            : existing.name,

        description:
          input.description !== undefined
            ? this.optionalString(input.description)
            : existing.description,

        active: input.active !== undefined ? input.active : existing.active,

        updatedAt: toPrisma8Timestamp(),
      });

      if (input.items !== undefined) {
        const items = this.normalizeItems(input.items);

        const now = toPrisma8Timestamp();

        for (const item of items) {
          await tx.orm.public.ChecklistTemplateItem.create({
            templateId: existing.id,

            title: item.title,

            description: item.description,

            position: item.position,

            required: item.required,

            createdAt: now,

            updatedAt: now,
          });
        }
      }
    });

    return this.requireTemplateForOrganization(
      membership.organizationId,
      templateId,
    );
  }

  async activateForUser(
    clerkUserId: string,
    templateId: string,
    activeOrganizationId?: string,
  ) {
    return this.setActiveForUser(
      clerkUserId,
      templateId,
      true,
      activeOrganizationId,
    );
  }

  async deactivateForUser(
    clerkUserId: string,
    templateId: string,
    activeOrganizationId?: string,
  ) {
    return this.setActiveForUser(
      clerkUserId,
      templateId,
      false,
      activeOrganizationId,
    );
  }

  async deleteForUser(
    clerkUserId: string,
    templateId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    await db.transaction(async (tx) => {
      await setPrisma8Serializable(tx);

      const existing = await this.requireTemplateForOrganization(
        membership.organizationId,
        templateId,
        tx,
      );

      await tx.orm.public.ChecklistTemplate.where({
        id: existing.id,
      }).delete();
    });

    return {
      success: true,
    };
  }

  private async setActiveForUser(
    clerkUserId: string,
    templateId: string,
    active: boolean,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const existing = await this.requireTemplateForOrganization(
      membership.organizationId,
      templateId,
    );

    if (existing.active === active) {
      return existing;
    }

    await db.orm.public.ChecklistTemplate.where({
      id: existing.id,
    }).update({
      active,

      updatedAt: toPrisma8Timestamp(),
    });

    return this.requireTemplateForOrganization(
      membership.organizationId,
      templateId,
    );
  }

  private async requireTemplateForOrganization(
    organizationId: string,
    templateId: string,
    tx?: DatabaseTransaction,
  ) {
    const orm = tx?.orm ?? db.orm;

    const template = await orm.public.ChecklistTemplate.where({
      id: templateId,

      organizationId,
    })
      .select(
        'id',
        'organizationId',
        'name',
        'description',
        'active',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!template) {
      throw new NotFoundException('Checklist template not found');
    }

    return this.hydrateTemplatePrisma8(template, tx);
  }

  private async hydrateTemplatePrisma8(
    template: {
      id: string;
      organizationId: string;
      name: string;
      description: string | null;
      active: boolean;
      createdAt: Parameters<typeof fromPrisma8Timestamp>[0];
      updatedAt: Parameters<typeof fromPrisma8Timestamp>[0];
    },
    tx?: DatabaseTransaction,
  ) {
    const orm = tx?.orm ?? db.orm;

    const items = await orm.public.ChecklistTemplateItem.where({
      templateId: template.id,
    })
      .select(
        'id',
        'templateId',
        'title',
        'description',
        'position',
        'required',
        'createdAt',
        'updatedAt',
      )
      .all();

    const hydratedItems = items.map((item) => ({
      ...item,

      createdAt: fromPrisma8Timestamp(item.createdAt),

      updatedAt: fromPrisma8Timestamp(item.updatedAt),
    }));

    /*
     * Preserve Prisma 7 item ordering:
     *   position ASC
     *   createdAt ASC
     */
    hydratedItems.sort((a, b) => {
      const positionDifference = a.position - b.position;

      if (positionDifference !== 0) {
        return positionDifference;
      }

      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    return {
      ...template,

      createdAt: fromPrisma8Timestamp(template.createdAt),

      updatedAt: fromPrisma8Timestamp(template.updatedAt),

      items: hydratedItems,
    };
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }

  private normalizeItems(
    items: Array<
      CreateChecklistTemplateItemDto | UpdateChecklistTemplateItemDto
    >,
  ) {
    return items.map((item, index) => ({
      title: this.requiredString(item.title),
      description: this.optionalString(item.description),
      position: item.position ?? index,
      required: item.required ?? false,
    }));
  }

  private requiredString(value: string) {
    return value.trim();
  }

  private optionalString(value: string | undefined) {
    const normalized = value?.trim();

    return normalized ? normalized : null;
  }
}
