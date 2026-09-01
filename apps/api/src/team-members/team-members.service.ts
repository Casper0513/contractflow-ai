import { Injectable } from '@nestjs/common';
import { prisma } from '@contractflow/db';

import { OrganizationMembershipService } from '../auth/organization-membership.service';

@Injectable()
export class TeamMembersService {
  constructor(
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async listForUser(clerkUserId: string, activeOrganizationId?: string) {
    const membership = await this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );

    const memberships = await prisma.membership.findMany({
      where: {
        organizationId: membership.organizationId,
      },

      orderBy: [
        {
          role: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],

      select: {
        id: true,
        role: true,

        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
    });

    return memberships.map((item) => ({
      membershipId: item.id,
      role: item.role,

      id: item.user.id,
      email: item.user.email,
      firstName: item.user.firstName,
      lastName: item.user.lastName,
      imageUrl: item.user.imageUrl,
    }));
  }
}
