import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@contractflow/db';

@Injectable()
export class TeamMembersService {
  async listForUser(clerkUserId: string) {
    const membership = await prisma.membership.findFirst({
      where: {
        user: {
          clerkUserId,
        },
      },

      orderBy: {
        createdAt: 'asc',
      },

      select: {
        organizationId: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('No organization membership found');
    }

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
