import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import { OrganizationRole } from '@contractflow/db';
import {
  db,
  fromPrisma8Timestamp,
  isPrisma8UniqueViolation,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { OrganizationMembershipService } from '../auth/organization-membership.service';
import type { Environment } from '../config/environment';

const INVITATION_EXPIRY_DAYS = 30;

const INVITABLE_ROLES = new Set<OrganizationRole>([
  OrganizationRole.ADMIN,
  OrganizationRole.MANAGER,
  OrganizationRole.TECHNICIAN,
  OrganizationRole.OFFICE,
  OrganizationRole.VIEWER,
]);

@Injectable()
export class TeamMembersService {
  constructor(
    private readonly organizationMemberships: OrganizationMembershipService,
    private readonly configService: ConfigService<Environment, true>,
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

  async listInvitationsForUser(
    clerkUserId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );

    const invitations = await db.orm.public.TeamInvitation.where({
      organizationId: membership.organizationId,
    })
      .select(
        'id',
        'email',
        'role',
        'expiresAt',
        'acceptedAt',
        'revokedAt',
        'createdAt',
      )
      .all();

    return invitations
      .sort(
        (a, b) =>
          fromPrisma8Timestamp(b.createdAt).getTime() -
          fromPrisma8Timestamp(a.createdAt).getTime(),
      )
      .map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: fromPrisma8Timestamp(invitation.expiresAt),
        acceptedAt: invitation.acceptedAt
          ? fromPrisma8Timestamp(invitation.acceptedAt)
          : null,
        revokedAt: invitation.revokedAt
          ? fromPrisma8Timestamp(invitation.revokedAt)
          : null,
        createdAt: fromPrisma8Timestamp(invitation.createdAt),
      }));
  }

  async inviteForUser(
    clerkUserId: string,
    email: string,
    role: OrganizationRole,
    activeOrganizationId?: string,
  ) {
    const actorMembership = await this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );

    if (!INVITABLE_ROLES.has(role)) {
      throw new BadRequestException(
        'OWNER cannot be assigned through a team invitation',
      );
    }

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      throw new BadRequestException('A valid email address is required');
    }

    /*
     * If this person is already synchronized into ContractFlow, attach
     * them directly. No Clerk invitation is needed because they already
     * have an application identity.
     */
    const existingUser = await db.orm.public.User.where({
      email: normalizedEmail,
    })
      .select('id', 'email')
      .first();

    if (existingUser) {
      const existingMembership = await db.orm.public.Membership.where({
        userId: existingUser.id,
        organizationId: actorMembership.organizationId,
      })
        .select('id')
        .first();

      if (existingMembership) {
        throw new ConflictException(
          'This user already belongs to the organization',
        );
      }

      const now = toPrisma8Timestamp();

      try {
        const createdMembership = await db.orm.public.Membership.create({
          userId: existingUser.id,
          organizationId: actorMembership.organizationId,
          role,
          createdAt: now,
          updatedAt: now,
        });

        return {
          kind: 'MEMBERSHIP' as const,
          membershipId: createdMembership.id,
          email: existingUser.email,
          role: createdMembership.role,
        };
      } catch (error) {
        if (isPrisma8UniqueViolation(error)) {
          throw new ConflictException(
            'This user already belongs to the organization',
          );
        }

        throw error;
      }
    }

    const now = new Date();

    /*
     * Fail closed if there is already an unclaimed invitation for this
     * organization/email. Clerk also protects against duplicate active
     * invitations, but keeping the local boundary explicit gives the UI
     * deterministic behavior.
     */
    const priorInvitations = await db.orm.public.TeamInvitation.where({
      organizationId: actorMembership.organizationId,
      email: normalizedEmail,
    })
      .select('id', 'acceptedAt', 'revokedAt', 'expiresAt')
      .all();

    const activeInvitation = priorInvitations.find((invitation) => {
      if (invitation.acceptedAt || invitation.revokedAt) {
        return false;
      }

      return (
        fromPrisma8Timestamp(invitation.expiresAt).getTime() > now.getTime()
      );
    });

    if (activeInvitation) {
      throw new ConflictException(
        'An active invitation already exists for this email address',
      );
    }

    const webUrl = this.configService.get('WEB_URL', {
      infer: true,
    });

    const clerk = createClerkClient({
      secretKey: this.configService.get('CLERK_SECRET_KEY', {
        infer: true,
      }),
    });

    let clerkInvitation;

    try {
      clerkInvitation = await clerk.invitations.createInvitation({
        emailAddress: normalizedEmail,
        expiresInDays: INVITATION_EXPIRY_DAYS,
        ignoreExisting: true,
        notify: true,
        redirectUrl: `${webUrl.replace(/\/$/, '')}/onboarding`,
      });
    } catch (error) {
      console.error(
        `Unable to create Clerk team invitation for ${normalizedEmail}:`,
        error,
      );

      throw new ServiceUnavailableException(
        'Unable to send the team invitation. Please try again.',
      );
    }

    const expiresAt = new Date(
      now.getTime() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    try {
      const invitation = await db.orm.public.TeamInvitation.create({
        organizationId: actorMembership.organizationId,
        invitedByUserId: actorMembership.userId,
        email: normalizedEmail,
        role,
        clerkInvitationId: clerkInvitation.id,
        expiresAt: toPrisma8Timestamp(expiresAt),
        acceptedAt: null,
        revokedAt: null,
        createdAt: toPrisma8Timestamp(now),
        updatedAt: toPrisma8Timestamp(now),
      });

      return {
        kind: 'INVITATION' as const,
        invitationId: invitation.id,
        email: normalizedEmail,
        role: invitation.role,
        expiresAt,
      };
    } catch (error) {
      /*
       * Clerk succeeded but local persistence failed. Revoke the external
       * invitation best-effort so we do not leave an unmanaged invite.
       */
      try {
        await clerk.invitations.revokeInvitation(clerkInvitation.id);
      } catch (revokeError) {
        console.error(
          `Unable to compensate Clerk invitation ${clerkInvitation.id}:`,
          revokeError,
        );
      }

      if (isPrisma8UniqueViolation(error)) {
        throw new ConflictException(
          'An invitation already exists for this user',
        );
      }

      throw error;
    }
  }

  async revokeInvitationForUser(
    clerkUserId: string,
    invitationId: string,
    activeOrganizationId?: string,
  ) {
    const actorMembership = await this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );

    const invitation = await db.orm.public.TeamInvitation.where({
      id: invitationId,
      organizationId: actorMembership.organizationId,
    })
      .select('id', 'clerkInvitationId', 'acceptedAt', 'revokedAt', 'expiresAt')
      .first();

    if (!invitation) {
      throw new NotFoundException('Team invitation not found');
    }

    if (invitation.acceptedAt) {
      throw new ConflictException('Accepted invitations cannot be revoked');
    }

    if (invitation.revokedAt) {
      return {
        success: true,
      };
    }

    const clerk = createClerkClient({
      secretKey: this.configService.get('CLERK_SECRET_KEY', {
        infer: true,
      }),
    });

    /*
     * An expired Clerk invitation may no longer be revocable. Only call
     * Clerk while the locally recorded invitation is still active.
     */
    if (fromPrisma8Timestamp(invitation.expiresAt).getTime() > Date.now()) {
      try {
        await clerk.invitations.revokeInvitation(invitation.clerkInvitationId);
      } catch (error) {
        console.error(
          `Unable to revoke Clerk invitation ${invitation.clerkInvitationId}:`,
          error,
        );

        throw new ServiceUnavailableException(
          'Unable to revoke the team invitation. Please try again.',
        );
      }
    }

    await db.orm.public.TeamInvitation.where({
      id: invitation.id,
    }).update({
      revokedAt: toPrisma8Timestamp(),
      updatedAt: toPrisma8Timestamp(),
    });

    return {
      success: true,
    };
  }

  async updateRoleForUser(
    clerkUserId: string,
    membershipId: string,
    role: OrganizationRole,
    activeOrganizationId?: string,
  ) {
    const actorMembership = await this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );

    const target = await db.orm.public.Membership.where({
      id: membershipId,
      organizationId: actorMembership.organizationId,
    })
      .select('id', 'userId', 'role')
      .first();

    if (!target) {
      throw new NotFoundException('Team member not found');
    }

    if (
      actorMembership.role !== OrganizationRole.OWNER &&
      (target.role === OrganizationRole.OWNER ||
        role === OrganizationRole.OWNER)
    ) {
      throw new ForbiddenException(
        'Only an owner can manage organization ownership',
      );
    }

    if (target.role === role) {
      return this.requireHydratedTeamMember(
        actorMembership.organizationId,
        target.id,
      );
    }

    if (
      target.role === OrganizationRole.OWNER &&
      role !== OrganizationRole.OWNER
    ) {
      await this.assertAnotherOwnerExists(
        actorMembership.organizationId,
        target.id,
      );
    }

    await db.orm.public.Membership.where({
      id: target.id,
    }).update({
      role,
      updatedAt: toPrisma8Timestamp(),
    });

    return this.requireHydratedTeamMember(
      actorMembership.organizationId,
      target.id,
    );
  }

  async removeForUser(
    clerkUserId: string,
    membershipId: string,
    activeOrganizationId?: string,
  ) {
    const actorMembership = await this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );

    const target = await db.orm.public.Membership.where({
      id: membershipId,
      organizationId: actorMembership.organizationId,
    })
      .select('id', 'role')
      .first();

    if (!target) {
      throw new NotFoundException('Team member not found');
    }

    if (
      actorMembership.role !== OrganizationRole.OWNER &&
      target.role === OrganizationRole.OWNER
    ) {
      throw new ForbiddenException(
        'Only an owner can manage organization ownership',
      );
    }

    if (target.role === OrganizationRole.OWNER) {
      await this.assertAnotherOwnerExists(
        actorMembership.organizationId,
        target.id,
      );
    }

    await db.orm.public.Membership.where({
      id: target.id,
    }).delete();

    return {
      success: true,
    };
  }

  private async assertAnotherOwnerExists(
    organizationId: string,
    excludedMembershipId: string,
  ) {
    const memberships = await db.orm.public.Membership.where({
      organizationId,
    })
      .select('id', 'role')
      .all();

    const anotherOwner = memberships.some(
      (membership) =>
        membership.id !== excludedMembershipId &&
        membership.role === OrganizationRole.OWNER,
    );

    if (!anotherOwner) {
      throw new ConflictException(
        'The organization must always have at least one owner',
      );
    }
  }

  private async requireHydratedTeamMember(
    organizationId: string,
    membershipId: string,
  ) {
    const membership = await db.orm.public.Membership.where({
      id: membershipId,
      organizationId,
    })
      .select('id', 'role', 'userId')
      .first();

    if (!membership) {
      throw new NotFoundException('Team member not found');
    }

    const user = await db.orm.public.User.where({
      id: membership.userId,
    })
      .select('id', 'email', 'firstName', 'lastName', 'imageUrl')
      .first();

    if (!user) {
      throw new NotFoundException('Team member user not found');
    }

    return {
      membershipId: membership.id,
      role: membership.role,
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
    };
  }
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
