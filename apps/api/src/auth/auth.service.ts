import {
  ConflictException,
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

import type { Environment } from '../config/environment';
import { OrganizationMembershipService } from './organization-membership.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService<Environment, true>,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async synchronizeUser(clerkUserId: string) {
    /*
     * Prefer the local ContractFlow user.
     *
     * Once a Clerk identity has already been synchronized into our
     * database, normal authenticated requests should not depend on a
     * live Clerk Backend API call.
     */
    const existingUser = await this.findHydratedUserByClerkId(clerkUserId);

    if (existingUser) {
      return existingUser;
    }

    /*
     * First-time user: Clerk is needed once so we can populate
     * the local ContractFlow user record.
     */
    const clerk = createClerkClient({
      secretKey: this.configService.get('CLERK_SECRET_KEY', {
        infer: true,
      }),
    });

    let clerkUser;

    try {
      clerkUser = await clerk.users.getUser(clerkUserId);
    } catch (error) {
      console.error(
        `Unable to synchronize new Clerk user ${clerkUserId}:`,
        error,
      );

      throw new ServiceUnavailableException(
        'Authentication provider is temporarily unavailable. Please try again.',
      );
    }

    const primaryEmail =
      clerkUser.emailAddresses.find(
        (email) => email.id === clerkUser.primaryEmailAddressId,
      ) ?? clerkUser.emailAddresses[0];

    if (!primaryEmail) {
      throw new NotFoundException('Authenticated account has no email address');
    }

    const normalizedEmail = normalizeEmail(primaryEmail.emailAddress);
    const now = toPrisma8Timestamp();

    const emailVerified =
      primaryEmail.verification?.status === 'verified' ? now : null;

    /*
     * Preserve the old upsert concurrency semantics:
     *
     * 1. Try to create.
     * 2. If another request wins the unique clerkUserId race,
     *    catch outside that failed write.
     * 3. Re-read and update using a fresh Prisma 8 operation.
     */
    try {
      await db.orm.public.User.create({
        clerkUserId,

        email: normalizedEmail,

        firstName: clerkUser.firstName,

        lastName: clerkUser.lastName,

        imageUrl: clerkUser.imageUrl,

        emailVerified,

        createdAt: now,

        updatedAt: now,
      });
    } catch (error) {
      if (!isPrisma8UniqueViolation(error)) {
        throw error;
      }
    }

    const user = await db.orm.public.User.where({
      clerkUserId,
    })
      .select('id')
      .first();

    if (!user) {
      throw new NotFoundException('Unable to synchronize authenticated user');
    }

    await db.orm.public.User.where({
      id: user.id,
    }).update({
      email: normalizedEmail,

      firstName: clerkUser.firstName,

      lastName: clerkUser.lastName,

      imageUrl: clerkUser.imageUrl,

      emailVerified,

      updatedAt: toPrisma8Timestamp(),
    });

    await this.claimPendingTeamInvitations(user.id, normalizedEmail);

    const synchronizedUser = await this.findHydratedUserByClerkId(clerkUserId);

    if (!synchronizedUser) {
      throw new NotFoundException('Unable to synchronize authenticated user');
    }

    return synchronizedUser;
  }

  async leaveOrganizationForUser(
    clerkUserId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );

    if (membership.role === OrganizationRole.OWNER) {
      await this.assertAnotherOwnerExists(
        membership.organizationId,
        membership.id,
      );
    }

    await db.orm.public.Membership.where({
      id: membership.id,
    }).delete();

    return {
      success: true,
    };
  }

  async deleteAccountForUser(clerkUserId: string) {
    const user = await db.orm.public.User.where({
      clerkUserId,
    })
      .select('id')
      .first();

    if (user) {
      const memberships = await db.orm.public.Membership.where({
        userId: user.id,
      })
        .select('id', 'organizationId', 'role')
        .all();

      for (const membership of memberships) {
        if (membership.role !== OrganizationRole.OWNER) {
          continue;
        }

        await this.assertAnotherOwnerExists(
          membership.organizationId,
          membership.id,
        );
      }
    }

    const clerk = createClerkClient({
      secretKey: this.configService.get('CLERK_SECRET_KEY', {
        infer: true,
      }),
    });

    try {
      await clerk.users.deleteUser(clerkUserId);
    } catch (error) {
      console.error(`Unable to delete Clerk user ${clerkUserId}:`, error);

      throw new ServiceUnavailableException(
        'Authentication provider is temporarily unavailable. Please try again.',
      );
    }

    if (user) {
      await db.orm.public.User.where({
        id: user.id,
      }).delete();
    }

    return {
      success: true,
    };
  }

  async handleClerkUserDeleted(clerkUserId: string) {
    const user = await db.orm.public.User.where({
      clerkUserId,
    })
      .select('id')
      .first();

    if (!user) {
      return {
        success: true,
        deleted: false,
        finalOwnerConflict: false,
      };
    }

    const memberships = await db.orm.public.Membership.where({
      userId: user.id,
    })
      .select('id', 'organizationId', 'role')
      .all();

    for (const membership of memberships) {
      if (membership.role !== OrganizationRole.OWNER) {
        continue;
      }

      const organizationMemberships = await db.orm.public.Membership.where({
        organizationId: membership.organizationId,
      })
        .select('id', 'role')
        .all();

      const anotherOwner = organizationMemberships.some(
        (candidate) =>
          candidate.id !== membership.id &&
          candidate.role === OrganizationRole.OWNER,
      );

      if (!anotherOwner) {
        console.error(
          `Clerk deleted final ContractFlow owner ${clerkUserId} for organization ${membership.organizationId}; local user retained for manual recovery`,
        );

        return {
          success: true,
          deleted: false,
          finalOwnerConflict: true,
        };
      }
    }

    await db.orm.public.User.where({
      id: user.id,
    }).delete();

    return {
      success: true,
      deleted: true,
      finalOwnerConflict: false,
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
        'Transfer ownership before leaving or deleting your account',
      );
    }
  }

  private async claimPendingTeamInvitations(
    userId: string,
    normalizedEmail: string,
  ) {
    const invitations = await db.orm.public.TeamInvitation.where({
      email: normalizedEmail,
    })
      .select(
        'id',
        'organizationId',
        'role',
        'expiresAt',
        'acceptedAt',
        'revokedAt',
      )
      .all();

    const now = new Date();

    for (const invitation of invitations) {
      if (invitation.acceptedAt || invitation.revokedAt) {
        continue;
      }

      if (
        fromPrisma8Timestamp(invitation.expiresAt).getTime() <= now.getTime()
      ) {
        continue;
      }

      try {
        await db.transaction(async (tx) => {
          const currentInvitation = await tx.orm.public.TeamInvitation.where({
            id: invitation.id,
          })
            .select(
              'id',
              'organizationId',
              'role',
              'expiresAt',
              'acceptedAt',
              'revokedAt',
            )
            .first();

          if (!currentInvitation) {
            return;
          }

          if (
            currentInvitation.acceptedAt ||
            currentInvitation.revokedAt ||
            fromPrisma8Timestamp(currentInvitation.expiresAt).getTime() <=
              Date.now()
          ) {
            return;
          }

          const existingMembership = await tx.orm.public.Membership.where({
            userId,
            organizationId: currentInvitation.organizationId,
          })
            .select('id')
            .first();

          const acceptedAt = toPrisma8Timestamp();

          if (!existingMembership) {
            await tx.orm.public.Membership.create({
              userId,
              organizationId: currentInvitation.organizationId,
              role: currentInvitation.role,
              createdAt: acceptedAt,
              updatedAt: acceptedAt,
            });
          }

          await tx.orm.public.TeamInvitation.where({
            id: currentInvitation.id,
          }).update({
            acceptedAt,
            updatedAt: acceptedAt,
          });
        });
      } catch (error) {
        /*
         * Concurrent first requests can race on Membership's unique
         * (userId, organizationId) constraint. The failed PostgreSQL
         * transaction cannot be reused, so recover outside it using
         * fresh Prisma operations.
         */
        if (!isPrisma8UniqueViolation(error)) {
          throw error;
        }

        const membership = await db.orm.public.Membership.where({
          userId,
          organizationId: invitation.organizationId,
        })
          .select('id')
          .first();

        if (!membership) {
          throw error;
        }

        const currentInvitation = await db.orm.public.TeamInvitation.where({
          id: invitation.id,
        })
          .select('id', 'acceptedAt', 'revokedAt', 'expiresAt')
          .first();

        if (
          !currentInvitation ||
          currentInvitation.acceptedAt ||
          currentInvitation.revokedAt ||
          fromPrisma8Timestamp(currentInvitation.expiresAt).getTime() <=
            Date.now()
        ) {
          continue;
        }

        const acceptedAt = toPrisma8Timestamp();

        await db.orm.public.TeamInvitation.where({
          id: currentInvitation.id,
        }).update({
          acceptedAt,
          updatedAt: acceptedAt,
        });
      }
    }
  }

  private async findHydratedUserByClerkId(clerkUserId: string) {
    const user = await db.orm.public.User.where({
      clerkUserId,
    })
      .select('id', 'clerkUserId', 'email', 'firstName', 'lastName', 'imageUrl')
      .first();

    if (!user) {
      return null;
    }

    const memberships = await db.orm.public.Membership.where({
      userId: user.id,
    })
      .select('id', 'role', 'organizationId', 'createdAt')
      .orderBy((model) => model.createdAt.asc())
      .all();

    const hydratedMemberships = [];

    for (const membership of memberships) {
      const organization = await db.orm.public.Organization.where({
        id: membership.organizationId,
      })
        .select('id', 'name', 'slug')
        .first();

      if (!organization) {
        continue;
      }

      hydratedMemberships.push({
        id: membership.id,

        role: membership.role,

        organization,
      });
    }

    return {
      ...user,
      memberships: hydratedMemberships,
    };
  }
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
