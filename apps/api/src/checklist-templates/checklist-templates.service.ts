import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@contractflow/db';

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
  async listForUser(clerkUserId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.checklistTemplate.findMany({
      where: {
        organizationId: membership.organizationId,
      },
      orderBy: [
        {
          active: 'desc',
        },
        {
          name: 'asc',
        },
      ],
      select: this.templateSelect(),
    });
  }

  async getForUser(clerkUserId: string, templateId: string) {
    const membership = await this.getMembership(clerkUserId);

    return this.requireTemplateForOrganization(
      membership.organizationId,
      templateId,
    );
  }

  async createForUser(clerkUserId: string, input: CreateChecklistTemplateDto) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const template = await tx.checklistTemplate.create({
        data: {
          organizationId: membership.organizationId,
          name: this.requiredString(input.name),
          description: this.optionalString(input.description),
          active: input.active ?? true,

          items: {
            create: this.normalizeItems(input.items ?? []),
          },
        },
        select: this.templateSelect(),
      });

      return template;
    });
  }

  async updateForUser(
    clerkUserId: string,
    templateId: string,
    input: UpdateChecklistTemplateDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const existing = await this.requireTemplateForOrganization(
        membership.organizationId,
        templateId,
        tx,
      );

      if (input.items !== undefined) {
        await tx.checklistTemplateItem.deleteMany({
          where: {
            templateId: existing.id,
          },
        });
      }

      return tx.checklistTemplate.update({
        where: {
          id: existing.id,
        },
        data: {
          ...(input.name !== undefined
            ? {
                name: this.requiredString(input.name),
              }
            : {}),

          ...(input.description !== undefined
            ? {
                description: this.optionalString(input.description),
              }
            : {}),

          ...(input.active !== undefined
            ? {
                active: input.active,
              }
            : {}),

          ...(input.items !== undefined
            ? {
                items: {
                  create: this.normalizeItems(input.items),
                },
              }
            : {}),
        },
        select: this.templateSelect(),
      });
    });
  }

  async activateForUser(clerkUserId: string, templateId: string) {
    return this.setActiveForUser(clerkUserId, templateId, true);
  }

  async deactivateForUser(clerkUserId: string, templateId: string) {
    return this.setActiveForUser(clerkUserId, templateId, false);
  }

  async deleteForUser(clerkUserId: string, templateId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const existing = await this.requireTemplateForOrganization(
        membership.organizationId,
        templateId,
        tx,
      );

      await tx.checklistTemplate.delete({
        where: {
          id: existing.id,
        },
      });

      return {
        success: true,
      };
    });
  }

  private async setActiveForUser(
    clerkUserId: string,
    templateId: string,
    active: boolean,
  ) {
    const membership = await this.getMembership(clerkUserId);

    const existing = await this.requireTemplateForOrganization(
      membership.organizationId,
      templateId,
    );

    if (existing.active === active) {
      return existing;
    }

    return prisma.checklistTemplate.update({
      where: {
        id: existing.id,
      },
      data: {
        active,
      },
      select: this.templateSelect(),
    });
  }

  private async requireTemplateForOrganization(
    organizationId: string,
    templateId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const template = await client.checklistTemplate.findFirst({
      where: {
        id: templateId,
        organizationId,
      },
      select: this.templateSelect(),
    });

    if (!template) {
      throw new NotFoundException('Checklist template not found');
    }

    return template;
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

  private templateSelect(): Prisma.ChecklistTemplateSelect {
    return {
      id: true,
      organizationId: true,
      name: true,
      description: true,
      active: true,
      createdAt: true,
      updatedAt: true,

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
          id: true,
          templateId: true,
          title: true,
          description: true,
          position: true,
          required: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    };
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
