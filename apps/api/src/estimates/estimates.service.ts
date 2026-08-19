import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerActivityType,
  EstimateStatus,
  Prisma,
  prisma,
} from '@contractflow/db';

import { ActivityService } from '../activity/activity.service';
import type { CreateEstimateDto } from './dto/create-estimate.dto';
import type { UpdateEstimateDto } from './dto/update-estimate.dto';
import { calculateEstimateTotals } from './estimate-calculations';

@Injectable()
export class EstimatesService {
  constructor(private readonly activityService: ActivityService) {}

  async listForUser(clerkUserId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.estimate.findMany({
      where: {
        organizationId: membership.organizationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: this.estimateSelect(),
    });
  }

  async listForJobForUser(clerkUserId: string, jobId: string) {
    const membership = await this.getMembership(clerkUserId);

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        organizationId: membership.organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return prisma.estimate.findMany({
      where: {
        organizationId: membership.organizationId,
        jobId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: this.estimateSelect(),
    });
  }

  async listForCustomerForUser(clerkUserId: string, customerId: string) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    return prisma.estimate.findMany({
      where: {
        organizationId: membership.organizationId,
        customerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: this.estimateSelect(),
    });
  }

  async getByIdForUser(clerkUserId: string, estimateId: string) {
    const membership = await this.getMembership(clerkUserId);

    const estimate = await prisma.estimate.findFirst({
      where: {
        id: estimateId,
        organizationId: membership.organizationId,
      },
      select: this.estimateSelect(),
    });

    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }

    return estimate;
  }

  async createForUser(clerkUserId: string, input: CreateEstimateDto) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      await this.requireCustomerForOrganization(
        membership.organizationId,
        input.customerId,
        tx,
      );

      if (input.jobId) {
        await this.requireJobForCustomer(
          membership.organizationId,
          input.customerId,
          input.jobId,
          tx,
        );
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

      const estimate = await tx.estimate.create({
        data: {
          organizationId: membership.organizationId,
          customerId: input.customerId,
          jobId: input.jobId ?? null,
          createdByUserId: membership.userId,

          number: estimateNumber,

          title: clean(input.title),
          notes: clean(input.notes),
          terms: clean(input.terms),

          validUntil: input.validUntil ? new Date(input.validUntil) : null,

          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          taxRate: totals.taxRate,
          taxCents: totals.taxCents,
          totalCents: totals.totalCents,

          lineItems: {
            create: input.lineItems.map((lineItem, index) => {
              const calculated = totals.lineItems[index];

              return {
                description: lineItem.description.trim(),

                quantity: calculated.quantity,

                unitPriceCents: calculated.unitPriceCents,

                lineTotalCents: calculated.lineTotalCents,

                position: index,
              };
            }),
          },
        },
        select: this.estimateSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,

          customerId: estimate.customerId,

          actorUserId: membership.userId,

          type: CustomerActivityType.ESTIMATE_CREATED,

          title: 'Estimate created',

          description: `${estimate.number} was created.`,

          metadata: {
            estimateId: estimate.id,
            estimateNumber: estimate.number,
            totalCents: estimate.totalCents,
          },
        },
        tx,
      );

      return estimate;
    });
  }

  async updateForUser(
    clerkUserId: string,
    estimateId: string,
    input: UpdateEstimateDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const existing = await this.requireEstimateForOrganization(
        membership.organizationId,
        estimateId,
        tx,
      );

      this.requireDraft(existing.status);

      const nextCustomerId = input.customerId ?? existing.customerId;

      const nextJobId =
        input.jobId !== undefined ? input.jobId : existing.jobId;

      await this.requireCustomerForOrganization(
        membership.organizationId,
        nextCustomerId,
        tx,
      );

      if (nextJobId) {
        await this.requireJobForCustomer(
          membership.organizationId,
          nextCustomerId,
          nextJobId,
          tx,
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
        const currentLineItems = await tx.estimateLineItem.findMany({
          where: {
            estimateId,
          },
          orderBy: {
            position: 'asc',
          },
          select: {
            quantity: true,
            unitPriceCents: true,
          },
        });

        totals = calculateEstimateTotals({
          lineItems: currentLineItems.map((lineItem) => ({
            quantity: Number(lineItem.quantity),

            unitPriceCents: lineItem.unitPriceCents,
          })),

          discountCents: input.discountCents ?? existing.discountCents,

          taxRate: input.taxRate ?? Number(existing.taxRate),
        });
      }

      const estimate = await tx.estimate.update({
        where: {
          id: estimateId,
        },

        data: {
          customerId: nextCustomerId,
          jobId: nextJobId,

          title:
            input.title !== undefined
              ? (clean(input.title) ?? null)
              : undefined,

          notes:
            input.notes !== undefined
              ? (clean(input.notes) ?? null)
              : undefined,

          terms:
            input.terms !== undefined
              ? (clean(input.terms) ?? null)
              : undefined,

          validUntil:
            input.validUntil !== undefined
              ? input.validUntil
                ? new Date(input.validUntil)
                : null
              : undefined,

          subtotalCents: totals?.subtotalCents,

          discountCents: totals?.discountCents,

          taxRate: totals?.taxRate,

          taxCents: totals?.taxCents,

          totalCents: totals?.totalCents,

          ...(input.lineItems
            ? {
                lineItems: {
                  deleteMany: {},

                  create: input.lineItems.map((lineItem, index) => {
                    const calculated = totals!.lineItems[index];

                    return {
                      description: lineItem.description.trim(),

                      quantity: calculated.quantity,

                      unitPriceCents: calculated.unitPriceCents,

                      lineTotalCents: calculated.lineTotalCents,

                      position: index,
                    };
                  }),
                },
              }
            : {}),
        },

        select: this.estimateSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,

          customerId: estimate.customerId,

          actorUserId: membership.userId,

          type: CustomerActivityType.ESTIMATE_UPDATED,

          title: 'Estimate updated',

          description: `${estimate.number} was updated.`,

          metadata: {
            estimateId: estimate.id,
            estimateNumber: estimate.number,
            totalCents: estimate.totalCents,
          },
        },
        tx,
      );

      return estimate;
    });
  }

  async sendForUser(clerkUserId: string, estimateId: string) {
    return this.transitionForUser(
      clerkUserId,
      estimateId,
      [EstimateStatus.DRAFT],
      EstimateStatus.SENT,
      'sentAt',
      CustomerActivityType.ESTIMATE_SENT,
      'Estimate sent',
      'was sent.',
    );
  }

  async viewForUser(clerkUserId: string, estimateId: string) {
    return this.transitionForUser(
      clerkUserId,
      estimateId,
      [EstimateStatus.SENT],
      EstimateStatus.VIEWED,
      'viewedAt',
      CustomerActivityType.ESTIMATE_VIEWED,
      'Estimate viewed',
      'was viewed.',
    );
  }

  async approveForUser(clerkUserId: string, estimateId: string) {
    return this.transitionForUser(
      clerkUserId,
      estimateId,
      [EstimateStatus.SENT, EstimateStatus.VIEWED],
      EstimateStatus.APPROVED,
      'approvedAt',
      CustomerActivityType.ESTIMATE_APPROVED,
      'Estimate approved',
      'was approved.',
    );
  }

  async declineForUser(clerkUserId: string, estimateId: string) {
    return this.transitionForUser(
      clerkUserId,
      estimateId,
      [EstimateStatus.SENT, EstimateStatus.VIEWED],
      EstimateStatus.DECLINED,
      'declinedAt',
      CustomerActivityType.ESTIMATE_DECLINED,
      'Estimate declined',
      'was declined.',
    );
  }

  async expireForUser(clerkUserId: string, estimateId: string) {
    return this.transitionForUser(
      clerkUserId,
      estimateId,
      [EstimateStatus.DRAFT, EstimateStatus.SENT, EstimateStatus.VIEWED],
      EstimateStatus.EXPIRED,
      'expiredAt',
      CustomerActivityType.ESTIMATE_EXPIRED,
      'Estimate expired',
      'was marked as expired.',
    );
  }

  private async transitionForUser(
    clerkUserId: string,
    estimateId: string,
    allowedStatuses: EstimateStatus[],
    nextStatus: EstimateStatus,
    timestampField:
      'sentAt' | 'viewedAt' | 'approvedAt' | 'declinedAt' | 'expiredAt',
    activityType: CustomerActivityType,
    activityTitle: string,
    activityDescription: string,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const existing = await this.requireEstimateForOrganization(
        membership.organizationId,
        estimateId,
        tx,
      );

      if (!allowedStatuses.includes(existing.status)) {
        throw new BadRequestException(
          `Estimate cannot transition from ${existing.status} to ${nextStatus}`,
        );
      }

      const now = new Date();

      const result = await tx.estimate.updateMany({
        where: {
          id: estimateId,

          organizationId: membership.organizationId,

          status: {
            in: allowedStatuses,
          },
        },

        data: {
          status: nextStatus,

          [timestampField]: now,
        },
      });

      if (result.count !== 1) {
        const current = await tx.estimate.findFirst({
          where: {
            id: estimateId,

            organizationId: membership.organizationId,
          },

          select: {
            status: true,
          },
        });

        if (!current) {
          throw new NotFoundException('Estimate not found');
        }

        throw new BadRequestException(
          `Estimate cannot transition from ${current.status} to ${nextStatus}`,
        );
      }

      const estimate = await tx.estimate.findFirst({
        where: {
          id: estimateId,

          organizationId: membership.organizationId,
        },

        select: this.estimateSelect(),
      });

      if (!estimate) {
        throw new NotFoundException('Estimate not found');
      }

      await this.activityService.recordCustomerActivity(
        {
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
        },
        tx,
      );

      return estimate;
    });
  }

  async processExpiredEstimates() {
    const now = new Date();

    const candidates = await prisma.estimate.findMany({
      where: {
        status: {
          in: [EstimateStatus.SENT, EstimateStatus.VIEWED],
        },

        validUntil: {
          not: null,
          lt: now,
        },
      },

      select: {
        id: true,
        organizationId: true,
        customerId: true,
        number: true,
        status: true,
        totalCents: true,
        validUntil: true,
      },
    });

    let expired = 0;
    let skipped = 0;
    const failures: Array<{
      estimateId: string;
      message: string;
    }> = [];

    for (const candidate of candidates) {
      try {
        await prisma.$transaction(async (tx) => {
          /*
           * Re-check the status and validUntil in the UPDATE itself.
           *
           * This protects against a customer approving/declining the
           * estimate at the same time the expiration scheduler runs.
           */
          const result = await tx.estimate.updateMany({
            where: {
              id: candidate.id,
              organizationId: candidate.organizationId,

              status: {
                in: [EstimateStatus.SENT, EstimateStatus.VIEWED],
              },

              validUntil: {
                not: null,
                lt: now,
              },
            },

            data: {
              status: EstimateStatus.EXPIRED,
              expiredAt: now,
            },
          });

          if (result.count !== 1) {
            skipped += 1;
            return;
          }

          await this.activityService.recordCustomerActivity(
            {
              organizationId: candidate.organizationId,

              customerId: candidate.customerId,

              actorUserId: null,

              type: CustomerActivityType.ESTIMATE_EXPIRED,

              title: 'Estimate expired',

              description: `${candidate.number} expired automatically.`,

              metadata: {
                estimateId: candidate.id,

                estimateNumber: candidate.number,

                previousStatus: candidate.status,

                status: EstimateStatus.EXPIRED,

                totalCents: candidate.totalCents,

                validUntil: candidate.validUntil?.toISOString() ?? null,

                source: 'estimate_expiration_scheduler',
              },
            },

            tx,
          );

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

  private requireDraft(status: EstimateStatus) {
    if (status !== EstimateStatus.DRAFT) {
      throw new BadRequestException('Only draft estimates can be edited');
    }
  }

  private async generateEstimateNumber(
    organizationId: string,
    tx: Prisma.TransactionClient,
  ) {
    const organization = await tx.organization.update({
      where: {
        id: organizationId,
      },

      data: {
        nextEstimateNumber: {
          increment: 1,
        },
      },

      select: {
        nextEstimateNumber: true,
      },
    });

    const sequence = organization.nextEstimateNumber - 1;

    return `EST-${String(sequence).padStart(5, '0')}`;
  }

  private async requireEstimateForOrganization(
    organizationId: string,
    estimateId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const estimate = await client.estimate.findFirst({
      where: {
        id: estimateId,
        organizationId,
      },

      select: {
        id: true,
        customerId: true,
        jobId: true,
        status: true,

        discountCents: true,

        taxRate: true,
      },
    });

    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }

    return estimate;
  }

  private async requireCustomerForOrganization(
    organizationId: string,
    customerId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const customer = await client.customer.findFirst({
      where: {
        id: customerId,
        organizationId,
      },

      select: {
        id: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  private async requireJobForCustomer(
    organizationId: string,
    customerId: string,
    jobId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const job = await client.job.findFirst({
      where: {
        id: jobId,
        organizationId,
        customerId,
      },

      select: {
        id: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found for this customer');
    }

    return job;
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

  private estimateSelect(): Prisma.EstimateSelect {
    return {
      id: true,
      organizationId: true,
      customerId: true,
      jobId: true,
      createdByUserId: true,

      number: true,
      status: true,
      title: true,

      notes: true,
      terms: true,

      validUntil: true,

      subtotalCents: true,
      discountCents: true,
      taxRate: true,
      taxCents: true,
      totalCents: true,

      sentAt: true,
      viewedAt: true,
      approvedAt: true,
      declinedAt: true,
      expiredAt: true,

      createdAt: true,
      updatedAt: true,

      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          companyName: true,
          email: true,
          phone: true,
        },
      },

      job: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },

      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },

      lineItems: {
        orderBy: {
          position: 'asc',
        },

        select: {
          id: true,
          description: true,
          quantity: true,
          unitPriceCents: true,
          lineTotalCents: true,
          position: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    };
  }
}

function clean(value: string | undefined): string | undefined {
  const result = value?.trim();

  return result || undefined;
}
