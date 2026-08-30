import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, type OrganizationRole } from '@contractflow/db';

export type ResolvedOrganizationMembership = {
  id: string;
  userId: string;
  organizationId: string;
  role: OrganizationRole;
};

@Injectable()
export class OrganizationMembershipService {
  async resolveForUser(
    clerkUserId: string,
  ): Promise<ResolvedOrganizationMembership> {
    const memberships = await prisma.membership.findMany({
      where: {
        user: {
          clerkUserId,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 2,
      select: {
        id: true,
        userId: true,
        organizationId: true,
        role: true,
      },
    });

    if (memberships.length === 0) {
      throw new NotFoundException('No organization membership found');
    }

    if (memberships.length > 1) {
      throw new ForbiddenException(
        'An active organization must be selected before continuing',
      );
    }

    return memberships[0];
  }
}
