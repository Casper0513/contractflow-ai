import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import { prisma } from '@contractflow/db';

import type { Environment } from '../config/environment';

const userSelect = {
  id: true,
  clerkUserId: true,
  email: true,
  firstName: true,
  lastName: true,
  imageUrl: true,

  memberships: {
    select: {
      id: true,
      role: true,

      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
} as const;

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
    const existingUser = await prisma.user.findUnique({
      where: {
        clerkUserId,
      },
      select: userSelect,
    });

    if (existingUser) {
      return existingUser;
    }

    /*
     * This is a first-time user that does not exist locally yet.
     * We need Clerk once so we can populate the local user record.
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

    /*
     * Use upsert rather than create so concurrent first requests for the
     * same Clerk user remain safe.
     */
    return prisma.user.upsert({
      where: {
        clerkUserId,
      },

      update: {
        email: primaryEmail.emailAddress,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl,

        emailVerified:
          primaryEmail.verification?.status === 'verified' ? new Date() : null,
      },

      create: {
        clerkUserId,
        email: primaryEmail.emailAddress,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl,

        emailVerified:
          primaryEmail.verification?.status === 'verified' ? new Date() : null,
      },

      select: userSelect,
    });
  }
}
