import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import {
  db,
  isPrisma8UniqueViolation,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import type { Environment } from '../config/environment';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService<Environment, true>,
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

        email: primaryEmail.emailAddress,

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
      email: primaryEmail.emailAddress,

      firstName: clerkUser.firstName,

      lastName: clerkUser.lastName,

      imageUrl: clerkUser.imageUrl,

      emailVerified,

      updatedAt: toPrisma8Timestamp(),
    });

    const synchronizedUser = await this.findHydratedUserByClerkId(clerkUserId);

    if (!synchronizedUser) {
      throw new NotFoundException('Unable to synchronize authenticated user');
    }

    return synchronizedUser;
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
