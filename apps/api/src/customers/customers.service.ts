import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@contractflow/db';

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

    return prisma.customer.create({
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
    await this.requireCustomer(clerkUserId, customerId);

    return prisma.customer.update({
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
  }

  async archiveForUser(clerkUserId: string, customerId: string) {
    await this.requireCustomer(clerkUserId, customerId);

    return prisma.customer.update({
      where: {
        id: customerId,
      },
      data: {
        archivedAt: new Date(),
      },
      select: this.customerSelect(),
    });
  }

  async restoreForUser(clerkUserId: string, customerId: string) {
    await this.requireCustomer(clerkUserId, customerId);

    return prisma.customer.update({
      where: {
        id: customerId,
      },
      data: {
        archivedAt: null,
      },
      select: this.customerSelect(),
    });
  }

  async deleteForUser(clerkUserId: string, customerId: string) {
    await this.requireCustomer(clerkUserId, customerId);

    await prisma.customer.delete({
      where: {
        id: customerId,
      },
    });

    return {
      success: true,
    };
  }

  private async requireCustomer(clerkUserId: string, customerId: string) {
    const membership = await this.getMembership(clerkUserId);

    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId: membership.organizationId,
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
