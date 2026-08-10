import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerActivityType, prisma } from '@contractflow/db';

import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  async listForUser(clerkUserId: string, includeArchived = false) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.customer.findMany({
      where: {
        organizationId: membership.organizationId,
        ...(includeArchived
          ? {}
          : {
              archivedAt: null,
            }),
      },
      orderBy: [
        {
          archivedAt: 'asc',
        },
        {
          createdAt: 'desc',
        },
      ],
      select: this.customerSelect(),
    });
  }

  async createForUser(clerkUserId: string, input: CreateCustomerDto) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          organizationId: membership.organizationId,
          firstName: input.firstName.trim(),
          lastName: clean(input.lastName),
          companyName: clean(input.companyName),
          email: clean(input.email)?.toLowerCase(),
          phone: clean(input.phone),
          notes: clean(input.notes),
        },
        select: this.customerSelect(),
      });

      const customerName = [customer.firstName, customer.lastName]
        .filter(Boolean)
        .join(' ');

      await tx.customerActivity.create({
        data: {
          organizationId: membership.organizationId,
          customerId: customer.id,
          actorUserId: membership.userId,
          type: CustomerActivityType.CUSTOMER_CREATED,
          title: 'Customer created',
          description: `${customerName} was added to the customer directory.`,
        },
      });

      return customer;
    });
  }

  async getByIdForUser(clerkUserId: string, customerId: string) {
    const membership = await this.getMembership(clerkUserId);

    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId: membership.organizationId,
      },
      select: this.customerSelect(),
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async updateForUser(
    clerkUserId: string,
    customerId: string,
    input: UpdateCustomerDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({
        where: {
          id: customerId,
        },
        data: {
          firstName:
            input.firstName !== undefined ? input.firstName.trim() : undefined,

          lastName:
            input.lastName !== undefined ? clean(input.lastName) : undefined,

          companyName:
            input.companyName !== undefined
              ? clean(input.companyName)
              : undefined,

          email:
            input.email !== undefined
              ? clean(input.email)?.toLowerCase()
              : undefined,

          phone: input.phone !== undefined ? clean(input.phone) : undefined,

          notes: input.notes !== undefined ? clean(input.notes) : undefined,
        },
        select: this.customerSelect(),
      });

      await tx.customerActivity.create({
        data: {
          organizationId: membership.organizationId,
          customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.CUSTOMER_UPDATED,
          title: 'Customer updated',
          description: 'Customer information was updated.',
          metadata: {
            changedFields: Object.entries(input)
              .filter(([, value]) => value !== undefined)
              .map(([field]) => field),
          },
        },
      });

      return customer;
    });
  }

  async archiveForUser(clerkUserId: string, customerId: string) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({
        where: {
          id: customerId,
        },
        data: {
          archivedAt: new Date(),
        },
        select: this.customerSelect(),
      });

      await tx.customerActivity.create({
        data: {
          organizationId: membership.organizationId,
          customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.CUSTOMER_ARCHIVED,
          title: 'Customer archived',
          description: 'Customer was moved out of the active directory.',
        },
      });

      return customer;
    });
  }

  async restoreForUser(clerkUserId: string, customerId: string) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({
        where: {
          id: customerId,
        },
        data: {
          archivedAt: null,
        },
        select: this.customerSelect(),
      });

      await tx.customerActivity.create({
        data: {
          organizationId: membership.organizationId,
          customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.CUSTOMER_RESTORED,
          title: 'Customer restored',
          description: 'Customer was restored to the active directory.',
        },
      });

      return customer;
    });
  }

  async listActivityForUser(clerkUserId: string, customerId: string) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    return prisma.customerActivity.findMany({
      where: {
        organizationId: membership.organizationId,
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

  async deleteForUser(clerkUserId: string, customerId: string) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    await prisma.customer.delete({
      where: {
        id: customerId,
      },
    });

    return {
      success: true,
    };
  }

  private async requireCustomerForOrganization(
    organizationId: string,
    customerId: string,
  ) {
    const customer = await prisma.customer.findFirst({
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

  private customerSelect() {
    return {
      id: true,
      firstName: true,
      lastName: true,
      companyName: true,
      email: true,
      phone: true,
      notes: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    };
  }
}

function clean(value: string | undefined): string | undefined {
  const result = value?.trim();

  return result || undefined;
}
