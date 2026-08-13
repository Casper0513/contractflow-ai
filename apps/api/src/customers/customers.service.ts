import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerActivityType, Prisma, prisma } from '@contractflow/db';

import { ActivityService } from '../activity/activity.service';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly activityService: ActivityService) {}

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

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: customer.id,
          actorUserId: membership.userId,
          type: CustomerActivityType.CUSTOMER_CREATED,
          title: 'Customer created',
          description: `${customerName} was added to the customer directory.`,
        },
        tx,
      );

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

    return prisma.$transaction(async (tx) => {
      const existingCustomer = await this.requireCustomerForOrganization(
        membership.organizationId,
        customerId,
        tx,
        {
          id: true,
          firstName: true,
          lastName: true,
          companyName: true,
          email: true,
          phone: true,
          notes: true,
        },
      );

      const nextValues = {
        firstName:
          input.firstName !== undefined
            ? input.firstName.trim()
            : existingCustomer.firstName,

        lastName:
          input.lastName !== undefined
            ? (clean(input.lastName) ?? null)
            : existingCustomer.lastName,

        companyName:
          input.companyName !== undefined
            ? (clean(input.companyName) ?? null)
            : existingCustomer.companyName,

        email:
          input.email !== undefined
            ? (clean(input.email)?.toLowerCase() ?? null)
            : existingCustomer.email,

        phone:
          input.phone !== undefined
            ? (clean(input.phone) ?? null)
            : existingCustomer.phone,

        notes:
          input.notes !== undefined
            ? (clean(input.notes) ?? null)
            : existingCustomer.notes,
      };

      const changes: Record<
        string,
        {
          oldValue: string | null;
          newValue: string | null;
        }
      > = {};

      for (const field of [
        'firstName',
        'lastName',
        'companyName',
        'email',
        'phone',
        'notes',
      ] as const) {
        const oldValue = existingCustomer[field];
        const newValue = nextValues[field];

        if (oldValue !== newValue) {
          changes[field] = {
            oldValue,
            newValue,
          };
        }
      }

      const customer = await tx.customer.update({
        where: {
          id: customerId,
        },
        data: {
          firstName: nextValues.firstName,
          lastName: nextValues.lastName,
          companyName: nextValues.companyName,
          email: nextValues.email,
          phone: nextValues.phone,
          notes: nextValues.notes,
        },
        select: this.customerSelect(),
      });

      if (Object.keys(changes).length > 0) {
        await this.activityService.recordCustomerActivity(
          {
            organizationId: membership.organizationId,
            customerId,
            actorUserId: membership.userId,
            type: CustomerActivityType.CUSTOMER_UPDATED,
            title: 'Customer updated',
            description: 'Customer information was updated.',
            metadata: {
              changes,
            },
          },
          tx,
        );
      }

      return customer;
    });
  }

  async archiveForUser(clerkUserId: string, customerId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      await this.requireCustomerForOrganization(
        membership.organizationId,
        customerId,
        tx,
      );

      const customer = await tx.customer.update({
        where: {
          id: customerId,
        },
        data: {
          archivedAt: new Date(),
        },
        select: this.customerSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.CUSTOMER_ARCHIVED,
          title: 'Customer archived',
          description: 'Customer was moved out of the active directory.',
        },
        tx,
      );

      return customer;
    });
  }

  async restoreForUser(clerkUserId: string, customerId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      await this.requireCustomerForOrganization(
        membership.organizationId,
        customerId,
        tx,
      );

      const customer = await tx.customer.update({
        where: {
          id: customerId,
        },
        data: {
          archivedAt: null,
        },
        select: this.customerSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.CUSTOMER_RESTORED,
          title: 'Customer restored',
          description: 'Customer was restored to the active directory.',
        },
        tx,
      );

      return customer;
    });
  }

  async listActivityForUser(clerkUserId: string, customerId: string) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    return this.activityService.listCustomerActivity(
      membership.organizationId,
      customerId,
    );
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
    client: typeof prisma | Prisma.TransactionClient = prisma,
    select: Prisma.CustomerSelect = {
      id: true,
    },
  ) {
    const customer = await client.customer.findFirst({
      where: {
        id: customerId,
        organizationId,
      },
      select,
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

  private customerSelect(): Prisma.CustomerSelect {
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
