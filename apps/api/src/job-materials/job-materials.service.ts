import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type DatabaseTransaction,
  db,
  fromPrisma8Timestamp,
  toPrisma8Numeric,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { OrganizationMembershipService } from '../auth/organization-membership.service';

import type { CreateJobMaterialDto } from './dto/create-job-material.dto';
import type { UpdateJobMaterialDto } from './dto/update-job-material.dto';

type OrmSource = typeof db.orm;

type JobMaterialStatus = 'REQUIRED' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';

type JobMaterialUnit =
  | 'EACH'
  | 'FOOT'
  | 'METER'
  | 'SQUARE_FOOT'
  | 'SQUARE_METER'
  | 'CUBIC_FOOT'
  | 'CUBIC_METER'
  | 'POUND'
  | 'KILOGRAM'
  | 'LITER'
  | 'GALLON'
  | 'BOX'
  | 'BAG'
  | 'BUNDLE'
  | 'ROLL'
  | 'SHEET'
  | 'OTHER';

type JobMaterialRecord = {
  id: string;
  organizationId: string;
  jobId: string;
  createdByUserId: string | null;

  name: string;
  description: string | null;

  quantity: {
    toString(): string;
  };

  unit: JobMaterialUnit;

  supplier: string | null;
  sku: string | null;
  reference: string | null;
  notes: string | null;

  estimatedUnitCostCents: number | null;
  actualUnitCostCents: number | null;
  billableUnitPriceCents: number | null;

  status: JobMaterialStatus;

  orderedAt: Parameters<typeof fromPrisma8Timestamp>[0] | null;

  receivedAt: Parameters<typeof fromPrisma8Timestamp>[0] | null;

  createdAt: Parameters<typeof fromPrisma8Timestamp>[0];

  updatedAt: Parameters<typeof fromPrisma8Timestamp>[0];
};

@Injectable()
export class JobMaterialsService {
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

    const materials = await db.orm.public.JobMaterial.where({
      organizationId: membership.organizationId,
      jobId,
    })
      .select(
        'id',
        'organizationId',
        'jobId',
        'createdByUserId',
        'name',
        'description',
        'quantity',
        'unit',
        'supplier',
        'sku',
        'reference',
        'notes',
        'estimatedUnitCostCents',
        'actualUnitCostCents',
        'billableUnitPriceCents',
        'status',
        'orderedAt',
        'receivedAt',
        'createdAt',
        'updatedAt',
      )
      .orderBy([
        (model) => model.status.asc(),
        (model) => model.createdAt.desc(),
      ])
      .all();

    return Promise.all(
      materials.map((material) => this.hydrateMaterial(db.orm, material)),
    );
  }

  async getForUser(
    clerkUserId: string,
    jobId: string,
    materialId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const material = await this.requireMaterialForJob(
      membership.organizationId,
      jobId,
      materialId,
    );

    return this.hydrateMaterial(db.orm, material);
  }

  async createForUser(
    clerkUserId: string,
    jobId: string,
    input: CreateJobMaterialDto,
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

      const material = await tx.orm.public.JobMaterial.create({
        organizationId: membership.organizationId,

        jobId,

        createdByUserId: membership.userId,

        name: input.name.trim(),

        description: cleanNullable(input.description),

        quantity: toPrisma8Numeric(String(input.quantity), 12, 3),

        unit: input.unit ?? 'EACH',

        supplier: cleanNullable(input.supplier),

        sku: cleanNullable(input.sku),

        reference: cleanNullable(input.reference),

        notes: cleanNullable(input.notes),

        estimatedUnitCostCents: input.estimatedUnitCostCents ?? null,

        actualUnitCostCents: input.actualUnitCostCents ?? null,

        billableUnitPriceCents: input.billableUnitPriceCents ?? null,

        status: 'REQUIRED',

        orderedAt: null,

        receivedAt: null,

        createdAt: now,

        updatedAt: now,
      });

      await tx.orm.public.CustomerActivity.create({
        organizationId: membership.organizationId,

        customerId: job.customerId,

        actorUserId: membership.userId,

        _type: 'JOB_MATERIAL_CREATED',

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

          billableUnitPriceCents: material.billableUnitPriceCents,
        },
      });

      return this.hydrateMaterial(tx.orm, material);
    });
  }

  async updateForUser(
    clerkUserId: string,
    jobId: string,
    materialId: string,
    input: UpdateJobMaterialDto,
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

      const existing = await this.requireMaterialForJob(
        membership.organizationId,
        jobId,
        materialId,
        tx.orm,
      );

      const nextValues = {
        name: input.name !== undefined ? input.name.trim() : existing.name,

        description:
          input.description !== undefined
            ? cleanNullable(input.description)
            : existing.description,

        quantity:
          input.quantity !== undefined
            ? toPrisma8Numeric(String(input.quantity), 12, 3)
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

        billableUnitPriceCents:
          input.billableUnitPriceCents !== undefined
            ? input.billableUnitPriceCents
            : existing.billableUnitPriceCents,
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

      addChange(
        changes,
        'billableUnitPriceCents',
        centsToString(existing.billableUnitPriceCents),
        centsToString(nextValues.billableUnitPriceCents),
      );

      await tx.orm.public.JobMaterial.where({
        id: materialId,
      }).update({
        name: nextValues.name,

        description: nextValues.description,

        quantity: nextValues.quantity,

        unit: nextValues.unit,

        supplier: nextValues.supplier,

        sku: nextValues.sku,

        reference: nextValues.reference,

        notes: nextValues.notes,

        estimatedUnitCostCents: nextValues.estimatedUnitCostCents,

        actualUnitCostCents: nextValues.actualUnitCostCents,

        billableUnitPriceCents: nextValues.billableUnitPriceCents,

        updatedAt: toPrisma8Timestamp(),
      });

      const material = await this.requireMaterialForJob(
        membership.organizationId,
        jobId,
        materialId,
        tx.orm,
      );

      if (Object.keys(changes).length > 0) {
        await tx.orm.public.CustomerActivity.create({
          organizationId: membership.organizationId,

          customerId: job.customerId,

          actorUserId: membership.userId,

          _type: 'JOB_MATERIAL_UPDATED',

          title: 'Material updated',

          description: `${material.name} was updated on ${job.name}.`,

          metadata: {
            jobId,

            jobName: job.name,

            materialId: material.id,

            materialName: material.name,

            changes,
          },
        });
      }

      return this.hydrateMaterial(tx.orm, material);
    });
  }

  async orderForUser(
    clerkUserId: string,
    jobId: string,
    materialId: string,
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

      const existing = await this.requireMaterialForJob(
        membership.organizationId,
        jobId,
        materialId,
        tx.orm,
      );

      if (existing.status !== 'REQUIRED') {
        throw new BadRequestException(
          'Only required materials can be marked as ordered',
        );
      }

      const now = toPrisma8Timestamp();

      await tx.orm.public.JobMaterial.where({
        id: materialId,
      }).update({
        status: 'ORDERED',

        orderedAt: now,

        receivedAt: null,

        updatedAt: now,
      });

      const material = await this.requireMaterialForJob(
        membership.organizationId,
        jobId,
        materialId,
        tx.orm,
      );

      await this.recordLifecycleActivity(
        tx,
        membership.organizationId,
        membership.userId,
        job,
        material,
        'Material ordered',
        `${material.name} was marked as ordered for ${job.name}.`,
        'REQUIRED',
        'ORDERED',
      );

      return this.hydrateMaterial(tx.orm, material);
    });
  }

  async receiveForUser(
    clerkUserId: string,
    jobId: string,
    materialId: string,
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

      const existing = await this.requireMaterialForJob(
        membership.organizationId,
        jobId,
        materialId,
        tx.orm,
      );

      if (existing.status !== 'REQUIRED' && existing.status !== 'ORDERED') {
        throw new BadRequestException(
          'Only required or ordered materials can be marked as received',
        );
      }

      const previousStatus = existing.status;

      const now = toPrisma8Timestamp();

      await tx.orm.public.JobMaterial.where({
        id: materialId,
      }).update({
        status: 'RECEIVED',

        orderedAt: existing.orderedAt ?? now,

        receivedAt: now,

        updatedAt: now,
      });

      const material = await this.requireMaterialForJob(
        membership.organizationId,
        jobId,
        materialId,
        tx.orm,
      );

      await this.recordLifecycleActivity(
        tx,
        membership.organizationId,
        membership.userId,
        job,
        material,
        'Material received',
        `${material.name} was marked as received for ${job.name}.`,
        previousStatus,
        'RECEIVED',
      );

      return this.hydrateMaterial(tx.orm, material);
    });
  }

  async cancelForUser(
    clerkUserId: string,
    jobId: string,
    materialId: string,
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

      const existing = await this.requireMaterialForJob(
        membership.organizationId,
        jobId,
        materialId,
        tx.orm,
      );

      if (existing.status !== 'REQUIRED' && existing.status !== 'ORDERED') {
        throw new BadRequestException(
          'Only required or ordered materials can be cancelled',
        );
      }

      const previousStatus = existing.status;

      await tx.orm.public.JobMaterial.where({
        id: materialId,
      }).update({
        status: 'CANCELLED',

        updatedAt: toPrisma8Timestamp(),
      });

      const material = await this.requireMaterialForJob(
        membership.organizationId,
        jobId,
        materialId,
        tx.orm,
      );

      await this.recordLifecycleActivity(
        tx,
        membership.organizationId,
        membership.userId,
        job,
        material,
        'Material cancelled',
        `${material.name} was cancelled for ${job.name}.`,
        previousStatus,
        'CANCELLED',
      );

      return this.hydrateMaterial(tx.orm, material);
    });
  }

  async restoreForUser(
    clerkUserId: string,
    jobId: string,
    materialId: string,
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

      const existing = await this.requireMaterialForJob(
        membership.organizationId,
        jobId,
        materialId,
        tx.orm,
      );

      if (existing.status !== 'CANCELLED') {
        throw new BadRequestException(
          'Only cancelled materials can be restored',
        );
      }

      await tx.orm.public.JobMaterial.where({
        id: materialId,
      }).update({
        status: 'REQUIRED',

        orderedAt: null,

        receivedAt: null,

        updatedAt: toPrisma8Timestamp(),
      });

      const material = await this.requireMaterialForJob(
        membership.organizationId,
        jobId,
        materialId,
        tx.orm,
      );

      await this.recordLifecycleActivity(
        tx,
        membership.organizationId,
        membership.userId,
        job,
        material,
        'Material restored',
        `${material.name} was restored to required for ${job.name}.`,
        'CANCELLED',
        'REQUIRED',
      );

      return this.hydrateMaterial(tx.orm, material);
    });
  }

  async deleteForUser(
    clerkUserId: string,
    jobId: string,
    materialId: string,
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

      const existing = await this.requireMaterialForJob(
        membership.organizationId,
        jobId,
        materialId,
        tx.orm,
      );

      await tx.orm.public.JobMaterial.where({
        id: materialId,
      }).delete();

      await tx.orm.public.CustomerActivity.create({
        organizationId: membership.organizationId,

        customerId: job.customerId,

        actorUserId: membership.userId,

        _type: 'JOB_MATERIAL_DELETED',

        title: 'Material deleted',

        description: `${existing.name} was removed from ${job.name}.`,

        metadata: {
          jobId,

          jobName: job.name,

          materialId: existing.id,

          materialName: existing.name,

          quantity: existing.quantity.toString(),

          unit: existing.unit,

          estimatedUnitCostCents: existing.estimatedUnitCostCents,

          actualUnitCostCents: existing.actualUnitCostCents,

          billableUnitPriceCents: existing.billableUnitPriceCents,
        },
      });

      return {
        success: true,
      };
    });
  }

  private async recordLifecycleActivity(
    tx: DatabaseTransaction,
    organizationId: string,
    actorUserId: string,
    job: {
      id: string;
      customerId: string;
      name: string;
    },
    material: JobMaterialRecord,
    title: string,
    description: string,
    previousStatus: JobMaterialStatus,
    nextStatus: JobMaterialStatus,
  ) {
    await tx.orm.public.CustomerActivity.create({
      organizationId,

      customerId: job.customerId,

      actorUserId,

      _type: 'JOB_MATERIAL_UPDATED',

      title,

      description,

      metadata: {
        jobId: job.id,

        jobName: job.name,

        materialId: material.id,

        materialName: material.name,

        previousStatus,

        status: nextStatus,

        orderedAt:
          material.orderedAt === null
            ? null
            : fromPrisma8Timestamp(material.orderedAt).toISOString(),

        receivedAt:
          material.receivedAt === null
            ? null
            : fromPrisma8Timestamp(material.receivedAt).toISOString(),
      },
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

  private async requireMaterialForJob(
    organizationId: string,
    jobId: string,
    materialId: string,
    orm: OrmSource = db.orm,
  ) {
    const material = await orm.public.JobMaterial.where({
      id: materialId,

      jobId,

      organizationId,
    })
      .select(
        'id',
        'organizationId',
        'jobId',
        'createdByUserId',
        'name',
        'description',
        'quantity',
        'unit',
        'supplier',
        'sku',
        'reference',
        'notes',
        'estimatedUnitCostCents',
        'actualUnitCostCents',
        'billableUnitPriceCents',
        'status',
        'orderedAt',
        'receivedAt',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!material) {
      throw new NotFoundException('Job material not found');
    }

    return material;
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }

  private async hydrateMaterial(orm: OrmSource, material: JobMaterialRecord) {
    const createdBy =
      material.createdByUserId === null
        ? null
        : await orm.public.User.where({
            id: material.createdByUserId,
          })
            .select('id', 'firstName', 'lastName', 'email')
            .first();

    return {
      id: material.id,

      organizationId: material.organizationId,

      jobId: material.jobId,

      createdByUserId: material.createdByUserId,

      name: material.name,

      description: material.description,

      quantity: material.quantity,

      unit: material.unit,

      supplier: material.supplier,

      sku: material.sku,

      reference: material.reference,

      notes: material.notes,

      estimatedUnitCostCents: material.estimatedUnitCostCents,

      actualUnitCostCents: material.actualUnitCostCents,

      billableUnitPriceCents: material.billableUnitPriceCents,

      status: material.status,

      orderedAt:
        material.orderedAt === null
          ? null
          : fromPrisma8Timestamp(material.orderedAt),

      receivedAt:
        material.receivedAt === null
          ? null
          : fromPrisma8Timestamp(material.receivedAt),

      createdAt: fromPrisma8Timestamp(material.createdAt),

      updatedAt: fromPrisma8Timestamp(material.updatedAt),

      createdBy,
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

function cleanNullable(value: string | null | undefined): string | null {
  const result = value?.trim();

  return result || null;
}

function centsToString(value: number | null): string | null {
  return value === null ? null : String(value);
}
