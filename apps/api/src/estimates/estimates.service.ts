import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstimateStatus } from '@contractflow/db';
import {
  type DatabaseTransaction,
  db,
  fromPrisma8Timestamp,
  prisma8TextParam,
  prisma8TimestampParam,
  toPrisma8Numeric,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { OrganizationMembershipService } from '../auth/organization-membership.service';
import type { AddEstimateMaterialsDto } from './dto/add-estimate-materials.dto';
import type { CreateEstimateDto } from './dto/create-estimate.dto';
import type { UpdateEstimateDto } from './dto/update-estimate.dto';
import { calculateEstimateTotals } from './estimate-calculations';

type OrmSource = typeof db.orm;

type EstimateActivityType =
  | 'ESTIMATE_CREATED'
  | 'ESTIMATE_UPDATED'
  | 'ESTIMATE_SENT'
  | 'ESTIMATE_VIEWED'
  | 'ESTIMATE_APPROVED'
  | 'ESTIMATE_DECLINED'
  | 'ESTIMATE_EXPIRED';

type EstimateTimestampField =
  'sentAt' | 'viewedAt' | 'approvedAt' | 'declinedAt' | 'expiredAt';

type CustomerActivityCreateInput = Parameters<
  DatabaseTransaction['orm']['public']['CustomerActivity']['create']
>[0];

type CustomerActivityMetadata = CustomerActivityCreateInput['metadata'];

@Injectable()
export class EstimatesService {
  constructor(
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async listForUser(clerkUserId: string, activeOrganizationId?: string) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const rows = await db.orm.public.Estimate.where({
      organizationId: membership.organizationId,
    })
      .select('id')
      .orderBy((model) => model.createdAt.desc())
      .all();

    return this.hydrateEstimateIds(
      db.orm,
      membership.organizationId,
      rows.map((row) => row.id),
    );
  }

  async listForJobForUser(
    clerkUserId: string,
    jobId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const job = await db.orm.public.Job.where({
      id: jobId,

      organizationId: membership.organizationId,
    })
      .select('id')
      .first();

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const rows = await db.orm.public.Estimate.where({
      organizationId: membership.organizationId,

      jobId,
    })
      .select('id')
      .orderBy((model) => model.createdAt.desc())
      .all();

    return this.hydrateEstimateIds(
      db.orm,
      membership.organizationId,
      rows.map((row) => row.id),
    );
  }

  async listForCustomerForUser(
    clerkUserId: string,
    customerId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    const rows = await db.orm.public.Estimate.where({
      organizationId: membership.organizationId,

      customerId,
    })
      .select('id')
      .orderBy((model) => model.createdAt.desc())
      .all();

    return this.hydrateEstimateIds(
      db.orm,
      membership.organizationId,
      rows.map((row) => row.id),
    );
  }

  async getByIdForUser(
    clerkUserId: string,
    estimateId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const estimate = await this.hydrateEstimate(
      db.orm,
      membership.organizationId,
      estimateId,
    );

    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }

    return estimate;
  }

  async createForUser(
    clerkUserId: string,
    input: CreateEstimateDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      await this.requireCustomerForOrganization(
        membership.organizationId,
        input.customerId,
        tx.orm,
      );

      const job = input.jobId
        ? await this.requireJobForCustomer(
            membership.organizationId,
            input.customerId,
            input.jobId,
            tx.orm,
          )
        : null;

      const organization = await tx.orm.public.Organization.where({
        id: membership.organizationId,
      })
        .select('currency')
        .first();

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      const totals = calculateEstimateTotals({
        lineItems: input.lineItems,

        discountCents: input.discountCents,

        taxRate: input.taxRate,
      });

      const estimateNumber = await this.generateEstimateNumber(
        membership.organizationId,
        tx,
      );

      const now = toPrisma8Timestamp();

      const estimate = await tx.orm.public.Estimate.create({
        organizationId: membership.organizationId,

        customerId: input.customerId,

        jobId: input.jobId ?? null,

        createdByUserId: membership.userId,

        number: estimateNumber,

        status: 'DRAFT',

        title: clean(input.title) ?? null,

        notes: clean(input.notes) ?? null,

        terms: clean(input.terms) ?? null,

        currency: job?.currency ?? organization.currency,

        validUntil: input.validUntil
          ? toPrisma8Timestamp(new Date(input.validUntil))
          : null,

        subtotalCents: totals.subtotalCents,

        discountCents: totals.discountCents,

        taxRate: toPrisma8Numeric(String(totals.taxRate), 7, 4),

        taxCents: totals.taxCents,

        totalCents: totals.totalCents,

        sentAt: null,

        viewedAt: null,

        approvedAt: null,

        declinedAt: null,

        expiredAt: null,

        createdAt: now,

        updatedAt: now,

        publicAccessCreatedAt: null,

        publicAccessToken: null,
      });

      for (let index = 0; index < input.lineItems.length; index += 1) {
        const lineItem = input.lineItems[index];

        const calculated = totals.lineItems[index];

        if (!lineItem || !calculated) {
          throw new BadRequestException('Invalid estimate line item');
        }

        await tx.orm.public.EstimateLineItem.create({
          estimateId: estimate.id,

          description: lineItem.description.trim(),

          quantity: toPrisma8Numeric(String(calculated.quantity), 12, 4),

          unitPriceCents: calculated.unitPriceCents,

          lineTotalCents: calculated.lineTotalCents,

          position: index,

          createdAt: now,

          updatedAt: now,

          sourceJobMaterialId: null,
        });
      }

      await this.createActivity(tx, {
        organizationId: membership.organizationId,

        customerId: estimate.customerId,

        actorUserId: membership.userId,

        type: 'ESTIMATE_CREATED',

        title: 'Estimate created',

        description: `${estimate.number} was created.`,

        metadata: {
          estimateId: estimate.id,

          estimateNumber: estimate.number,

          totalCents: estimate.totalCents,
        },
      });

      const hydrated = await this.hydrateEstimate(
        tx.orm,
        membership.organizationId,
        estimate.id,
      );

      if (!hydrated) {
        throw new NotFoundException('Estimate not found');
      }

      return hydrated;
    });
  }

  async updateForUser(
    clerkUserId: string,
    estimateId: string,
    input: UpdateEstimateDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const existing = await this.requireEstimateForOrganization(
        membership.organizationId,
        estimateId,
        tx.orm,
      );

      this.requireDraft(existing.status);

      const nextCustomerId = input.customerId ?? existing.customerId;

      const nextJobId =
        input.jobId !== undefined ? input.jobId : existing.jobId;

      await this.requireCustomerForOrganization(
        membership.organizationId,
        nextCustomerId,
        tx.orm,
      );

      const nextJob = nextJobId
        ? await this.requireJobForCustomer(
            membership.organizationId,
            nextCustomerId,
            nextJobId,
            tx.orm,
          )
        : null;

      if (nextJob && nextJob.currency !== existing.currency) {
        throw new BadRequestException(
          'This estimate cannot be moved to a job with a different currency',
        );
      }

      let totals: ReturnType<typeof calculateEstimateTotals> | undefined;

      if (input.lineItems) {
        totals = calculateEstimateTotals({
          lineItems: input.lineItems,

          discountCents: input.discountCents ?? existing.discountCents,

          taxRate: input.taxRate ?? Number(existing.taxRate),
        });
      } else if (
        input.discountCents !== undefined ||
        input.taxRate !== undefined
      ) {
        const currentLineItems = await this.readCurrentLineItems(
          tx,
          estimateId,
        );

        totals = calculateEstimateTotals({
          lineItems: currentLineItems.map((lineItem) => ({
            quantity: Number(lineItem.quantity),

            unitPriceCents: lineItem.unitPriceCents,
          })),

          discountCents: input.discountCents ?? existing.discountCents,

          taxRate: input.taxRate ?? Number(existing.taxRate),
        });
      }

      const current = await tx.orm.public.Estimate.where({
        id: estimateId,

        organizationId: membership.organizationId,
      })
        .select(
          'title',
          'notes',
          'terms',
          'validUntil',
          'subtotalCents',
          'discountCents',
          'taxRate',
          'taxCents',
          'totalCents',
        )
        .first();

      if (!current) {
        throw new NotFoundException('Estimate not found');
      }

      const now = toPrisma8Timestamp();

      if (input.lineItems) {
        await this.replaceLineItems(
          tx,
          estimateId,
          input.lineItems.map((lineItem, index) => {
            const calculated = totals?.lineItems[index];

            if (!calculated) {
              throw new BadRequestException('Invalid estimate line item');
            }

            return {
              description: lineItem.description.trim(),

              quantity: calculated.quantity,

              unitPriceCents: calculated.unitPriceCents,

              lineTotalCents: calculated.lineTotalCents,

              position: index,
            };
          }),
          now,
        );
      }

      const updated = await tx.orm.public.Estimate.where({
        id: estimateId,

        organizationId: membership.organizationId,
      }).update({
        customerId: nextCustomerId,

        jobId: nextJobId,

        title:
          input.title !== undefined
            ? (clean(input.title) ?? null)
            : current.title,

        notes:
          input.notes !== undefined
            ? (clean(input.notes) ?? null)
            : current.notes,

        terms:
          input.terms !== undefined
            ? (clean(input.terms) ?? null)
            : current.terms,

        validUntil:
          input.validUntil !== undefined
            ? input.validUntil
              ? toPrisma8Timestamp(new Date(input.validUntil))
              : null
            : current.validUntil,

        subtotalCents: totals?.subtotalCents ?? current.subtotalCents,

        discountCents: totals?.discountCents ?? current.discountCents,

        taxRate: totals
          ? toPrisma8Numeric(String(totals.taxRate), 7, 4)
          : toPrisma8Numeric(current.taxRate.toString(), 7, 4),

        taxCents: totals?.taxCents ?? current.taxCents,

        totalCents: totals?.totalCents ?? current.totalCents,

        updatedAt: now,
      });

      if (!updated) {
        throw new NotFoundException('Estimate not found');
      }

      await this.createActivity(tx, {
        organizationId: membership.organizationId,

        customerId: updated.customerId,

        actorUserId: membership.userId,

        type: 'ESTIMATE_UPDATED',

        title: 'Estimate updated',

        description: `${updated.number} was updated.`,

        metadata: {
          estimateId: updated.id,

          estimateNumber: updated.number,

          totalCents: updated.totalCents,
        },
      });

      const hydrated = await this.hydrateEstimate(
        tx.orm,
        membership.organizationId,
        updated.id,
      );

      if (!hydrated) {
        throw new NotFoundException('Estimate not found');
      }

      return hydrated;
    });
  }

  async addMaterialsForUser(
    clerkUserId: string,
    estimateId: string,
    input: AddEstimateMaterialsDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const existing = await this.requireEstimateForOrganization(
        membership.organizationId,
        estimateId,
        tx.orm,
      );

      this.requireDraft(existing.status);

      if (!existing.jobId) {
        throw new BadRequestException(
          'Materials can only be added to an estimate linked to a job',
        );
      }

      const currentLineItems = await this.readCurrentLineItems(tx, estimateId);

      const existingMaterialIds = new Set(
        currentLineItems
          .map((lineItem) => lineItem.sourceJobMaterialId)
          .filter((materialId): materialId is string => materialId !== null),
      );

      const alreadyAdded = input.materialIds.filter((materialId) =>
        existingMaterialIds.has(materialId),
      );

      if (alreadyAdded.length > 0) {
        throw new BadRequestException(
          'One or more selected materials have already been added to this estimate',
        );
      }

      const allMaterials = await tx.orm.public.JobMaterial.where({
        organizationId: membership.organizationId,

        jobId: existing.jobId,
      })
        .select(
          'id',
          'name',
          'description',
          'quantity',
          'status',
          'billableUnitPriceCents',
        )
        .all();

      const materialsById = new Map(
        allMaterials.map((material) => [material.id, material]),
      );

      const selectedMaterials = input.materialIds.map((materialId) => {
        const material = materialsById.get(materialId);

        if (!material) {
          throw new NotFoundException(
            'One or more selected materials were not found for this job',
          );
        }

        if (material.status === 'CANCELLED') {
          throw new BadRequestException(
            `${material.name} is cancelled and cannot be added to an estimate`,
          );
        }

        if (material.billableUnitPriceCents === null) {
          throw new BadRequestException(
            `${material.name} does not have a customer unit price`,
          );
        }

        return material;
      });

      const importedLineItems = selectedMaterials.map((material) => {
        const billableUnitPriceCents = material.billableUnitPriceCents;

        if (billableUnitPriceCents === null) {
          throw new BadRequestException(
            `${material.name} does not have a customer unit price`,
          );
        }

        return {
          description: formatMaterialLineItemDescription(
            material.name,
            material.description,
          ),

          quantity: Number(material.quantity),

          unitPriceCents: billableUnitPriceCents,

          sourceJobMaterialId: material.id,
        };
      });

      const calculationLineItems = [
        ...currentLineItems.map((lineItem) => ({
          description: lineItem.description,

          quantity: Number(lineItem.quantity),

          unitPriceCents: lineItem.unitPriceCents,
        })),

        ...importedLineItems.map((lineItem) => ({
          description: lineItem.description,

          quantity: lineItem.quantity,

          unitPriceCents: lineItem.unitPriceCents,
        })),
      ];

      const totals = calculateEstimateTotals({
        lineItems: calculationLineItems,

        discountCents: existing.discountCents,

        taxRate: Number(existing.taxRate),
      });

      const highestPosition = currentLineItems.reduce(
        (highest, lineItem) => Math.max(highest, lineItem.position),
        -1,
      );

      const firstImportedIndex = currentLineItems.length;

      const now = toPrisma8Timestamp();

      for (let index = 0; index < importedLineItems.length; index += 1) {
        const lineItem = importedLineItems[index];

        const calculated = totals.lineItems[firstImportedIndex + index];

        if (!lineItem || !calculated) {
          throw new BadRequestException('Invalid imported estimate material');
        }

        await tx.orm.public.EstimateLineItem.create({
          estimateId,

          description: lineItem.description,

          quantity: toPrisma8Numeric(String(calculated.quantity), 12, 4),

          unitPriceCents: calculated.unitPriceCents,

          lineTotalCents: calculated.lineTotalCents,

          sourceJobMaterialId: lineItem.sourceJobMaterialId,

          position: highestPosition + index + 1,

          createdAt: now,

          updatedAt: now,
        });
      }

      const updated = await tx.orm.public.Estimate.where({
        id: estimateId,

        organizationId: membership.organizationId,
      }).update({
        subtotalCents: totals.subtotalCents,

        discountCents: totals.discountCents,

        taxRate: toPrisma8Numeric(String(totals.taxRate), 7, 4),

        taxCents: totals.taxCents,

        totalCents: totals.totalCents,

        updatedAt: now,
      });

      if (!updated) {
        throw new NotFoundException('Estimate not found');
      }

      await this.createActivity(tx, {
        organizationId: membership.organizationId,

        customerId: updated.customerId,

        actorUserId: membership.userId,

        type: 'ESTIMATE_UPDATED',

        title: 'Materials added to estimate',

        description: `${selectedMaterials.length} material${
          selectedMaterials.length === 1 ? '' : 's'
        } added to ${updated.number}.`,

        metadata: {
          estimateId: updated.id,

          estimateNumber: updated.number,

          jobId: existing.jobId,

          materialIds: selectedMaterials.map((material) => material.id),

          materialCount: selectedMaterials.length,

          totalCents: updated.totalCents,
        },
      });

      const hydrated = await this.hydrateEstimate(
        tx.orm,
        membership.organizationId,
        updated.id,
      );

      if (!hydrated) {
        throw new NotFoundException('Estimate not found');
      }

      return hydrated;
    });
  }

  async sendForUser(
    clerkUserId: string,
    estimateId: string,
    activeOrganizationId?: string,
  ) {
    return this.transitionForUser(
      clerkUserId,
      estimateId,
      [EstimateStatus.DRAFT],
      EstimateStatus.SENT,
      'sentAt',
      'ESTIMATE_SENT',
      'Estimate sent',
      'was sent.',
      activeOrganizationId,
    );
  }

  async viewForUser(
    clerkUserId: string,
    estimateId: string,
    activeOrganizationId?: string,
  ) {
    return this.transitionForUser(
      clerkUserId,
      estimateId,
      [EstimateStatus.SENT],
      EstimateStatus.VIEWED,
      'viewedAt',
      'ESTIMATE_VIEWED',
      'Estimate viewed',
      'was viewed.',
      activeOrganizationId,
    );
  }

  async approveForUser(
    clerkUserId: string,
    estimateId: string,
    activeOrganizationId?: string,
  ) {
    return this.transitionForUser(
      clerkUserId,
      estimateId,
      [EstimateStatus.SENT, EstimateStatus.VIEWED],
      EstimateStatus.APPROVED,
      'approvedAt',
      'ESTIMATE_APPROVED',
      'Estimate approved',
      'was approved.',
      activeOrganizationId,
    );
  }

  async declineForUser(
    clerkUserId: string,
    estimateId: string,
    activeOrganizationId?: string,
  ) {
    return this.transitionForUser(
      clerkUserId,
      estimateId,
      [EstimateStatus.SENT, EstimateStatus.VIEWED],
      EstimateStatus.DECLINED,
      'declinedAt',
      'ESTIMATE_DECLINED',
      'Estimate declined',
      'was declined.',
      activeOrganizationId,
    );
  }

  async expireForUser(
    clerkUserId: string,
    estimateId: string,
    activeOrganizationId?: string,
  ) {
    return this.transitionForUser(
      clerkUserId,
      estimateId,
      [EstimateStatus.DRAFT, EstimateStatus.SENT, EstimateStatus.VIEWED],
      EstimateStatus.EXPIRED,
      'expiredAt',
      'ESTIMATE_EXPIRED',
      'Estimate expired',
      'was marked as expired.',
      activeOrganizationId,
    );
  }

  private async transitionForUser(
    clerkUserId: string,
    estimateId: string,
    allowedStatuses: readonly string[],
    nextStatus: string,
    timestampField: EstimateTimestampField,
    activityType: EstimateActivityType,
    activityTitle: string,
    activityDescription: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const existing = await this.requireEstimateForOrganization(
        membership.organizationId,
        estimateId,
        tx.orm,
      );

      if (!allowedStatuses.includes(existing.status)) {
        throw new BadRequestException(
          `Estimate cannot transition from ${existing.status} to ${nextStatus}`,
        );
      }

      const affectedRows = await this.executeTransitionCas(
        tx,
        membership.organizationId,
        estimateId,
        nextStatus,
        timestampField,
      );

      if (affectedRows !== 1) {
        const current = await tx.orm.public.Estimate.where({
          id: estimateId,

          organizationId: membership.organizationId,
        })
          .select('status')
          .first();

        if (!current) {
          throw new NotFoundException('Estimate not found');
        }

        throw new BadRequestException(
          `Estimate cannot transition from ${current.status} to ${nextStatus}`,
        );
      }

      const estimate = await this.hydrateEstimate(
        tx.orm,
        membership.organizationId,
        estimateId,
      );

      if (!estimate) {
        throw new NotFoundException('Estimate not found');
      }

      await this.createActivity(tx, {
        organizationId: membership.organizationId,

        customerId: estimate.customerId,

        actorUserId: membership.userId,

        type: activityType,

        title: activityTitle,

        description: `${estimate.number} ${activityDescription}`,

        metadata: {
          estimateId: estimate.id,

          estimateNumber: estimate.number,

          previousStatus: existing.status,

          status: estimate.status,

          totalCents: estimate.totalCents,
        },
      });

      return estimate;
    });
  }

  async processExpiredEstimates() {
    const now = new Date();

    const allEstimates = await db.orm.public.Estimate.select(
      'id',
      'organizationId',
      'customerId',
      'number',
      'status',
      'totalCents',
      'validUntil',
    ).all();

    const candidates = allEstimates.filter((estimate) => {
      if (
        estimate.status !== EstimateStatus.SENT &&
        estimate.status !== EstimateStatus.VIEWED
      ) {
        return false;
      }

      if (estimate.validUntil === null) {
        return false;
      }

      return (
        fromPrisma8Timestamp(estimate.validUntil).getTime() < now.getTime()
      );
    });

    let expired = 0;
    let skipped = 0;

    const failures: Array<{
      estimateId: string;
      message: string;
    }> = [];

    for (const candidate of candidates) {
      try {
        await db.transaction(async (tx) => {
          const timestamp = toPrisma8Timestamp(now);

          const plan = db.raw.sql`
                UPDATE "Estimate"
                SET
                  "status" = 'EXPIRED',
                  "expiredAt" = ${prisma8TimestampParam(timestamp)},
                  "updatedAt" = ${prisma8TimestampParam(timestamp)}
                WHERE
                  "id" = ${prisma8TextParam(candidate.id)}
                  AND "organizationId" = ${prisma8TextParam(
                    candidate.organizationId,
                  )}
                  AND "status" IN ('SENT', 'VIEWED')
                  AND "validUntil" IS NOT NULL
                  AND "validUntil" < ${prisma8TimestampParam(timestamp)}
              `
            .affectedCount()
            .build();

          const result = await tx.execute(plan);

          if (result.affectedRows !== 1) {
            skipped += 1;
            return;
          }

          await this.createActivity(tx, {
            organizationId: candidate.organizationId,

            customerId: candidate.customerId,

            actorUserId: null,

            type: 'ESTIMATE_EXPIRED',

            title: 'Estimate expired',

            description: `${candidate.number} expired automatically.`,

            metadata: {
              estimateId: candidate.id,

              estimateNumber: candidate.number,

              previousStatus: candidate.status,

              status: EstimateStatus.EXPIRED,

              totalCents: candidate.totalCents,

              validUntil:
                candidate.validUntil === null
                  ? null
                  : fromPrisma8Timestamp(candidate.validUntil).toISOString(),

              source: 'estimate_expiration_scheduler',
            },
          });

          expired += 1;
        });
      } catch (error) {
        failures.push({
          estimateId: candidate.id,

          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      scanned: candidates.length,

      expired,

      skipped,

      failures,
    };
  }

  private requireDraft(status: string) {
    if (status !== EstimateStatus.DRAFT) {
      throw new BadRequestException('Only draft estimates can be edited');
    }
  }

  private async generateEstimateNumber(
    organizationId: string,
    tx: DatabaseTransaction,
  ) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const organization = await tx.orm.public.Organization.where({
        id: organizationId,
      })
        .select('nextEstimateNumber')
        .first();

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      const sequence = organization.nextEstimateNumber;

      const next = sequence + 1;

      const now = toPrisma8Timestamp();

      const plan = db.raw.sql`
          UPDATE "Organization"
          SET
            "nextEstimateNumber" = ${next},
            "updatedAt" = ${prisma8TimestampParam(now)}
          WHERE
            "id" = ${prisma8TextParam(organizationId)}
            AND "nextEstimateNumber" = ${sequence}
        `
        .affectedCount()
        .build();

      const result = await tx.execute(plan);

      if (result.affectedRows === 1) {
        return `EST-${String(sequence).padStart(5, '0')}`;
      }
    }

    throw new BadRequestException(
      'Unable to allocate estimate number after concurrent retries',
    );
  }

  private async requireEstimateForOrganization(
    organizationId: string,
    estimateId: string,
    orm: OrmSource = db.orm,
  ) {
    const estimate = await orm.public.Estimate.where({
      id: estimateId,

      organizationId,
    })
      .select(
        'id',
        'customerId',
        'jobId',
        'status',
        'currency',
        'discountCents',
        'taxRate',
      )
      .first();

    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }

    return estimate;
  }

  private async requireCustomerForOrganization(
    organizationId: string,
    customerId: string,
    orm: OrmSource = db.orm,
  ) {
    const customer = await orm.public.Customer.where({
      id: customerId,

      organizationId,
    })
      .select('id')
      .first();

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  private async requireJobForCustomer(
    organizationId: string,
    customerId: string,
    jobId: string,
    orm: OrmSource = db.orm,
  ) {
    const job = await orm.public.Job.where({
      id: jobId,

      organizationId,

      customerId,
    })
      .select('id', 'currency')
      .first();

    if (!job) {
      throw new NotFoundException('Job not found for this customer');
    }

    return job;
  }

  private async hydrateEstimateIds(
    orm: OrmSource,
    organizationId: string,
    ids: string[],
  ) {
    const result = [];

    for (const id of ids) {
      const estimate = await this.hydrateEstimate(orm, organizationId, id);

      if (estimate) {
        result.push(estimate);
      }
    }

    return result;
  }

  private async hydrateEstimate(
    orm: OrmSource,
    organizationId: string,
    estimateId: string,
  ) {
    const estimate = await orm.public.Estimate.where({
      id: estimateId,

      organizationId,
    })
      .select(
        'id',
        'organizationId',
        'customerId',
        'jobId',
        'createdByUserId',

        'number',
        'status',
        'title',
        'notes',
        'terms',
        'currency',

        'validUntil',

        'subtotalCents',
        'discountCents',
        'taxRate',
        'taxCents',
        'totalCents',

        'sentAt',
        'viewedAt',
        'approvedAt',
        'declinedAt',
        'expiredAt',

        'createdAt',
        'updatedAt',
      )
      .first();

    if (!estimate) {
      return null;
    }

    const customer = await orm.public.Customer.where({
      id: estimate.customerId,

      organizationId,
    })
      .select('id', 'firstName', 'lastName', 'companyName', 'email', 'phone')
      .first();

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const job =
      estimate.jobId === null
        ? null
        : await orm.public.Job.where({
            id: estimate.jobId,

            organizationId,
          })
            .select('id', 'name', 'status')
            .first();

    const createdBy =
      estimate.createdByUserId === null
        ? null
        : await orm.public.User.where({
            id: estimate.createdByUserId,
          })
            .select('id', 'firstName', 'lastName', 'email')
            .first();

    const lineItems = await orm.public.EstimateLineItem.where({
      estimateId: estimate.id,
    })
      .select(
        'id',
        'description',
        'quantity',
        'unitPriceCents',
        'lineTotalCents',
        'sourceJobMaterialId',
        'position',
        'createdAt',
        'updatedAt',
      )
      .orderBy((model) => model.position.asc())
      .all();

    return {
      id: estimate.id,

      organizationId: estimate.organizationId,

      customerId: estimate.customerId,

      jobId: estimate.jobId,

      createdByUserId: estimate.createdByUserId,

      number: estimate.number,

      status: estimate.status,

      title: estimate.title,

      notes: estimate.notes,

      terms: estimate.terms,

      currency: estimate.currency,

      validUntil:
        estimate.validUntil === null
          ? null
          : fromPrisma8Timestamp(estimate.validUntil),

      subtotalCents: estimate.subtotalCents,

      discountCents: estimate.discountCents,

      taxRate: estimate.taxRate.toString(),

      taxCents: estimate.taxCents,

      totalCents: estimate.totalCents,

      sentAt:
        estimate.sentAt === null ? null : fromPrisma8Timestamp(estimate.sentAt),

      viewedAt:
        estimate.viewedAt === null
          ? null
          : fromPrisma8Timestamp(estimate.viewedAt),

      approvedAt:
        estimate.approvedAt === null
          ? null
          : fromPrisma8Timestamp(estimate.approvedAt),

      declinedAt:
        estimate.declinedAt === null
          ? null
          : fromPrisma8Timestamp(estimate.declinedAt),

      expiredAt:
        estimate.expiredAt === null
          ? null
          : fromPrisma8Timestamp(estimate.expiredAt),

      createdAt: fromPrisma8Timestamp(estimate.createdAt),

      updatedAt: fromPrisma8Timestamp(estimate.updatedAt),

      customer,

      job,

      createdBy,

      lineItems: lineItems.map((lineItem) => ({
        id: lineItem.id,

        description: lineItem.description,

        quantity: lineItem.quantity.toString(),

        unitPriceCents: lineItem.unitPriceCents,

        lineTotalCents: lineItem.lineTotalCents,

        sourceJobMaterialId: lineItem.sourceJobMaterialId,

        position: lineItem.position,

        createdAt: fromPrisma8Timestamp(lineItem.createdAt),

        updatedAt: fromPrisma8Timestamp(lineItem.updatedAt),
      })),
    };
  }

  private async readCurrentLineItems(
    tx: DatabaseTransaction,
    estimateId: string,
  ) {
    return tx.orm.public.EstimateLineItem.where({
      estimateId,
    })
      .select(
        'id',
        'description',
        'quantity',
        'unitPriceCents',
        'lineTotalCents',
        'position',
        'sourceJobMaterialId',
      )
      .orderBy((model) => model.position.asc())
      .all();
  }

  private async replaceLineItems(
    tx: DatabaseTransaction,
    estimateId: string,
    lineItems: Array<{
      description: string;
      quantity:
        | number
        | {
            toString(): string;
          };
      unitPriceCents: number;
      lineTotalCents: number;
      position: number;
    }>,
    now: ReturnType<typeof toPrisma8Timestamp>,
  ) {
    const existing = await tx.orm.public.EstimateLineItem.where({
      estimateId,
    })
      .select('id')
      .all();

    for (const item of existing) {
      await tx.orm.public.EstimateLineItem.where({
        id: item.id,
      }).delete();
    }

    for (const lineItem of lineItems) {
      await tx.orm.public.EstimateLineItem.create({
        estimateId,

        description: lineItem.description,

        quantity: toPrisma8Numeric(String(lineItem.quantity), 12, 4),

        unitPriceCents: lineItem.unitPriceCents,

        lineTotalCents: lineItem.lineTotalCents,

        position: lineItem.position,

        createdAt: now,

        updatedAt: now,

        sourceJobMaterialId: null,
      });
    }
  }

  private async executeTransitionCas(
    tx: DatabaseTransaction,
    organizationId: string,
    estimateId: string,
    nextStatus: string,
    timestampField: EstimateTimestampField,
  ) {
    const now = toPrisma8Timestamp();

    let plan;

    if (nextStatus === EstimateStatus.SENT && timestampField === 'sentAt') {
      plan = db.raw.sql`
          UPDATE "Estimate"
          SET
            "status" = 'SENT',
            "sentAt" = ${prisma8TimestampParam(now)},
            "updatedAt" = ${prisma8TimestampParam(now)}
          WHERE
            "id" = ${prisma8TextParam(estimateId)}
            AND "organizationId" = ${prisma8TextParam(organizationId)}
            AND "status" = 'DRAFT'
        `
        .affectedCount()
        .build();
    } else if (
      nextStatus === EstimateStatus.VIEWED &&
      timestampField === 'viewedAt'
    ) {
      plan = db.raw.sql`
          UPDATE "Estimate"
          SET
            "status" = 'VIEWED',
            "viewedAt" = ${prisma8TimestampParam(now)},
            "updatedAt" = ${prisma8TimestampParam(now)}
          WHERE
            "id" = ${prisma8TextParam(estimateId)}
            AND "organizationId" = ${prisma8TextParam(organizationId)}
            AND "status" = 'SENT'
        `
        .affectedCount()
        .build();
    } else if (
      nextStatus === EstimateStatus.APPROVED &&
      timestampField === 'approvedAt'
    ) {
      plan = db.raw.sql`
          UPDATE "Estimate"
          SET
            "status" = 'APPROVED',
            "approvedAt" = ${prisma8TimestampParam(now)},
            "updatedAt" = ${prisma8TimestampParam(now)}
          WHERE
            "id" = ${prisma8TextParam(estimateId)}
            AND "organizationId" = ${prisma8TextParam(organizationId)}
            AND "status" IN ('SENT', 'VIEWED')
        `
        .affectedCount()
        .build();
    } else if (
      nextStatus === EstimateStatus.DECLINED &&
      timestampField === 'declinedAt'
    ) {
      plan = db.raw.sql`
          UPDATE "Estimate"
          SET
            "status" = 'DECLINED',
            "declinedAt" = ${prisma8TimestampParam(now)},
            "updatedAt" = ${prisma8TimestampParam(now)}
          WHERE
            "id" = ${prisma8TextParam(estimateId)}
            AND "organizationId" = ${prisma8TextParam(organizationId)}
            AND "status" IN ('SENT', 'VIEWED')
        `
        .affectedCount()
        .build();
    } else if (
      nextStatus === EstimateStatus.EXPIRED &&
      timestampField === 'expiredAt'
    ) {
      plan = db.raw.sql`
          UPDATE "Estimate"
          SET
            "status" = 'EXPIRED',
            "expiredAt" = ${prisma8TimestampParam(now)},
            "updatedAt" = ${prisma8TimestampParam(now)}
          WHERE
            "id" = ${prisma8TextParam(estimateId)}
            AND "organizationId" = ${prisma8TextParam(organizationId)}
            AND "status" IN ('DRAFT', 'SENT', 'VIEWED')
        `
        .affectedCount()
        .build();
    } else {
      throw new BadRequestException('Invalid estimate status transition');
    }

    const result = await tx.execute(plan);

    return result.affectedRows;
  }

  private async createActivity(
    tx: DatabaseTransaction,
    input: {
      organizationId: string;
      customerId: string;

      actorUserId: string | null;

      type: EstimateActivityType;

      title: string;
      description: string;

      metadata: CustomerActivityMetadata;
    },
  ) {
    await tx.orm.public.CustomerActivity.create({
      organizationId: input.organizationId,

      customerId: input.customerId,

      actorUserId: input.actorUserId,

      _type: input.type,

      title: input.title,

      description: input.description,

      metadata: input.metadata,

      createdAt: toPrisma8Timestamp(),
    });
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }
}

function clean(value: string | undefined): string | undefined {
  const result = value?.trim();

  return result || undefined;
}

function formatMaterialLineItemDescription(
  name: string,
  description: string | null,
) {
  const cleanName = name.trim();

  const cleanDescription = description?.trim();

  if (!cleanDescription) {
    return cleanName;
  }

  return `${cleanName} — ${cleanDescription}`;
}
