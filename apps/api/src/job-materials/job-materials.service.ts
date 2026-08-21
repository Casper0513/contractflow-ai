import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CustomerActivityType,
  JobMaterialUnit,
  Prisma,
  prisma,
} from '@contractflow/db';

import { ActivityService } from '../activity/activity.service';
import type { CreateJobMaterialDto } from './dto/create-job-material.dto';
import type { UpdateJobMaterialDto } from './dto/update-job-material.dto';

@Injectable()
export class JobMaterialsService {
  constructor(private readonly activityService: ActivityService) {}

  async listForJobForUser(clerkUserId: string, jobId: string) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireJobForOrganization(membership.organizationId, jobId);

    return prisma.jobMaterial.findMany({
      where: {
        organizationId: membership.organizationId,
        jobId,
      },

      orderBy: [
        {
          status: 'asc',
        },
        {
          createdAt: 'desc',
        },
      ],

      select: this.materialSelect(),
    });
  }

  async getForUser(clerkUserId: string, jobId: string, materialId: string) {
    const membership = await this.getMembership(clerkUserId);

    return this.requireMaterialForJob(
      membership.organizationId,
      jobId,
      materialId,
    );
  }

  async createForUser(
    clerkUserId: string,
    jobId: string,
    input: CreateJobMaterialDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const material = await tx.jobMaterial.create({
        data: {
          organizationId: membership.organizationId,

          jobId,

          createdByUserId: membership.userId,

          name: input.name.trim(),

          description: clean(input.description),

          quantity: new Prisma.Decimal(input.quantity),

          unit: input.unit ?? JobMaterialUnit.EACH,

          supplier: clean(input.supplier),

          sku: clean(input.sku),

          reference: clean(input.reference),

          notes: clean(input.notes),

          estimatedUnitCostCents: input.estimatedUnitCostCents,

          actualUnitCostCents: input.actualUnitCostCents,
        },

        select: this.materialSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,

          customerId: job.customerId,

          actorUserId: membership.userId,

          type: CustomerActivityType.JOB_MATERIAL_CREATED,

          title: 'Material added',

          description: `${material.name} was added to ${job.name}.`,

          metadata: {
            jobId,
            jobName: job.name,

            materialId: material.id,

            materialName: material.name,

            quantity: material.quantity.toString(),

            unit: material.unit,

            estimatedUnitCostCents: material.estimatedUnitCostCents,

            actualUnitCostCents: material.actualUnitCostCents,
          },
        },
        tx,
      );

      return material;
    });
  }

  async updateForUser(
    clerkUserId: string,
    jobId: string,
    materialId: string,
    input: UpdateJobMaterialDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const existing = await this.requireMaterialForJob(
        membership.organizationId,
        jobId,
        materialId,
        tx,
      );

      const nextValues = {
        name: input.name !== undefined ? input.name.trim() : existing.name,

        description:
          input.description !== undefined
            ? cleanNullable(input.description)
            : existing.description,

        quantity:
          input.quantity !== undefined
            ? new Prisma.Decimal(input.quantity)
            : existing.quantity,

        unit: input.unit !== undefined ? input.unit : existing.unit,

        supplier:
          input.supplier !== undefined
            ? cleanNullable(input.supplier)
            : existing.supplier,

        sku: input.sku !== undefined ? cleanNullable(input.sku) : existing.sku,

        reference:
          input.reference !== undefined
            ? cleanNullable(input.reference)
            : existing.reference,

        notes:
          input.notes !== undefined
            ? cleanNullable(input.notes)
            : existing.notes,

        estimatedUnitCostCents:
          input.estimatedUnitCostCents !== undefined
            ? input.estimatedUnitCostCents
            : existing.estimatedUnitCostCents,

        actualUnitCostCents:
          input.actualUnitCostCents !== undefined
            ? input.actualUnitCostCents
            : existing.actualUnitCostCents,
      };

      const changes: MaterialChangeMap = {};

      addChange(changes, 'name', existing.name, nextValues.name);

      addChange(
        changes,
        'description',
        existing.description,
        nextValues.description,
      );

      addChange(
        changes,
        'quantity',
        existing.quantity.toString(),
        nextValues.quantity.toString(),
      );

      addChange(changes, 'unit', existing.unit, nextValues.unit);

      addChange(changes, 'supplier', existing.supplier, nextValues.supplier);

      addChange(changes, 'sku', existing.sku, nextValues.sku);

      addChange(changes, 'reference', existing.reference, nextValues.reference);

      addChange(changes, 'notes', existing.notes, nextValues.notes);

      addChange(
        changes,
        'estimatedUnitCostCents',
        centsToString(existing.estimatedUnitCostCents),
        centsToString(nextValues.estimatedUnitCostCents),
      );

      addChange(
        changes,
        'actualUnitCostCents',
        centsToString(existing.actualUnitCostCents),
        centsToString(nextValues.actualUnitCostCents),
      );

      const material = await tx.jobMaterial.update({
        where: {
          id: materialId,
        },

        data: nextValues,

        select: this.materialSelect(),
      });

      if (Object.keys(changes).length > 0) {
        await this.activityService.recordCustomerActivity(
          {
            organizationId: membership.organizationId,

            customerId: job.customerId,

            actorUserId: membership.userId,

            type: CustomerActivityType.JOB_MATERIAL_UPDATED,

            title: 'Material updated',

            description: `${material.name} was updated on ${job.name}.`,

            metadata: {
              jobId,
              jobName: job.name,

              materialId: material.id,

              materialName: material.name,

              changes,
            },
          },
          tx,
        );
      }

      return material;
    });
  }

  async deleteForUser(clerkUserId: string, jobId: string, materialId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const existing = await this.requireMaterialForJob(
        membership.organizationId,
        jobId,
        materialId,
        tx,
      );

      await tx.jobMaterial.delete({
        where: {
          id: materialId,
        },
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,

          customerId: job.customerId,

          actorUserId: membership.userId,

          type: CustomerActivityType.JOB_MATERIAL_DELETED,

          title: 'Material deleted',

          description: `${existing.name} was removed from ${job.name}.`,

          metadata: {
            jobId,
            jobName: job.name,

            materialId: existing.id,

            materialName: existing.name,

            quantity: existing.quantity.toString(),

            unit: existing.unit,
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

  private async requireMaterialForJob(
    organizationId: string,
    jobId: string,
    materialId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const material = await client.jobMaterial.findFirst({
      where: {
        id: materialId,
        jobId,
        organizationId,
      },

      select: this.materialSelect(),
    });

    if (!material) {
      throw new NotFoundException('Job material not found');
    }

    return material;
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

  private materialSelect(): Prisma.JobMaterialSelect {
    return {
      id: true,
      organizationId: true,
      jobId: true,
      createdByUserId: true,

      name: true,
      description: true,

      quantity: true,
      unit: true,

      supplier: true,
      sku: true,
      reference: true,
      notes: true,

      estimatedUnitCostCents: true,
      actualUnitCostCents: true,

      status: true,

      orderedAt: true,
      receivedAt: true,

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

type MaterialChangeMap = Record<
  string,
  {
    oldValue: string | null;
    newValue: string | null;
  }
>;

function addChange(
  changes: MaterialChangeMap,
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

function clean(value: string | undefined): string | undefined {
  const result = value?.trim();

  return result || undefined;
}

function cleanNullable(value: string | null | undefined): string | null {
  const result = value?.trim();

  return result || null;
}

function centsToString(value: number | null): string | null {
  return value === null ? null : String(value);
}
