import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type OrganizationRole } from '@contractflow/db';
import { db } from '@contractflow/db-prisma8';

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
    const user = await db.orm.public.User.where({
      clerkUserId,
    })
      .select('id')
      .first();

    if (!user) {
      if (organizationId) {
        throw new ForbiddenException(
          'You do not belong to the selected organization',
        );
      }

      throw new NotFoundException('No organization membership found');
    }

    if (organizationId) {
      const membership = await db.orm.public.Membership.where({
        organizationId,
        userId: user.id,
      })
        .select('id', 'userId', 'organizationId', 'role')
        .first();

      if (!membership) {
        throw new ForbiddenException(
          'You do not belong to the selected organization',
        );
      }

      return {
        ...membership,
        role: membership.role,
      };
    }

    const memberships = await db.orm.public.Membership.where({
      userId: user.id,
    })
      .select('id', 'userId', 'organizationId', 'role', 'createdAt')
      .orderBy((model) => model.createdAt.asc())
      .all();

    /*
     * Preserve the existing fail-closed semantics:
     * zero memberships => not found
     * more than one => require explicit active organization.
     */
    const discovered = memberships.slice(0, 2);

    if (discovered.length === 0) {
      throw new NotFoundException('No organization membership found');
    }

    if (discovered.length > 1) {
      throw new ForbiddenException(
        'An active organization must be selected before continuing',
      );
    }

    const membership = discovered[0];

    if (!membership) {
      throw new NotFoundException('No organization membership found');
    }

    return {
      id: membership.id,

      userId: membership.userId,

      organizationId: membership.organizationId,

      role: membership.role,
    };
  }
}
