import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClerkClient } from "@clerk/backend";
import { prisma } from "@contractflow/db";

import type { Environment } from "../config/environment";

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService<
      Environment,
      true
    >,
  ) {}

  async synchronizeUser(clerkUserId: string) {
    const clerk = createClerkClient({
      secretKey: this.configService.get(
        "CLERK_SECRET_KEY",
        {
          infer: true,
        },
      ),
    });

    const clerkUser =
      await clerk.users.getUser(clerkUserId);

    const primaryEmail =
      clerkUser.emailAddresses.find(
        (email) =>
          email.id ===
          clerkUser.primaryEmailAddressId,
      ) ?? clerkUser.emailAddresses[0];

    if (!primaryEmail) {
      throw new NotFoundException(
        "Authenticated account has no email address",
      );
    }

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
          primaryEmail.verification?.status ===
          "verified"
            ? new Date()
            : null,
      },
      create: {
        clerkUserId,
        email: primaryEmail.emailAddress,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl,
        emailVerified:
          primaryEmail.verification?.status ===
          "verified"
            ? new Date()
            : null,
      },
      select: {
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
      },
    });
  }
}