import { Injectable } from '@nestjs/common';
import { db, fromPrisma8Timestamp } from '@contractflow/db-prisma8';

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

    const memberships = await db.orm.public.Membership.where({
      organizationId: membership.organizationId,
    })
      .select('id', 'role', 'userId', 'createdAt')
      .all();

    /*
     * Preserve Prisma 7 ordering:
     *   role ASC
     *   createdAt ASC
     */
    memberships.sort((a, b) => {
      const roleCompare = String(a.role).localeCompare(String(b.role));

      if (roleCompare !== 0) {
        return roleCompare;
      }

      return (
        fromPrisma8Timestamp(a.createdAt).getTime() -
        fromPrisma8Timestamp(b.createdAt).getTime()
      );
    });

    const result = [];

    for (const item of memberships) {
      const user = await db.orm.public.User.where({
        id: item.userId,
      })
        .select('id', 'email', 'firstName', 'lastName', 'imageUrl')
        .first();

      if (!user) {
        continue;
      }

      result.push({
        membershipId: item.id,

        role: item.role,

        id: user.id,

        email: user.email,

        firstName: user.firstName,

        lastName: user.lastName,

        imageUrl: user.imageUrl,
      });
    }

    return result;
  }
}
