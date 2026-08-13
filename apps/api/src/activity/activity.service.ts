import { Injectable } from '@nestjs/common';
import { CustomerActivityType, Prisma, prisma } from '@contractflow/db';

type RecordCustomerActivityInput = {
  organizationId: string;
  customerId: string;
  actorUserId?: string | null;
  type: CustomerActivityType;
  title: string;
  description?: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class ActivityService {
  async recordCustomerActivity(
    input: RecordCustomerActivityInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? prisma;

    return client.customerActivity.create({
      data: {
        organizationId: input.organizationId,
        customerId: input.customerId,
        actorUserId: input.actorUserId ?? null,
        type: input.type,
        title: input.title,
        description: input.description,
        metadata: input.metadata,
      },
    });
  }

  async listCustomerActivity(organizationId: string, customerId: string) {
    return prisma.customerActivity.findMany({
      where: {
        organizationId,
        customerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        metadata: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }
}
