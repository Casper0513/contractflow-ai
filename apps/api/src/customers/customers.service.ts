import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { prisma } from "@contractflow/db";

import type { CreateCustomerDto } from "./dto/create-customer.dto";

@Injectable()
export class CustomersService {
  async listForUser(clerkUserId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.customer.findMany({
      where: {
        organizationId: membership.organizationId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        companyName: true,
        email: true,
        phone: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createForUser(
    clerkUserId: string,
    input: CreateCustomerDto,
  ) {
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
      select: {
        id: true,
        firstName: true,
        lastName: true,
        companyName: true,
        email: true,
        phone: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
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
      throw new NotFoundException(
        "No organization membership found",
      );
    }

    return membership;
  }
}

function clean(
  value: string | undefined,
): string | undefined {
  const result = value?.trim();

  return result || undefined;
}
