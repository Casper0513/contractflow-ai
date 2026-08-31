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
    organizationId?: string,
  ): Promise<ResolvedOrganizationMembership> {
    if (organizationId) {
      const membership = await prisma.membership.findFirst({
        where: {
          organizationId,
          user: {
            clerkUserId,
          },
        },
        select: {
          id: true,
          userId: true,
          organizationId: true,
          role: true,
        },
      });

      if (!membership) {
        throw new ForbiddenException(
          'You do not belong to the selected organization',
        );
      }

      return membership;
    }

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
